import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { HubError, notFound } from '$lib/server/errors';
import * as storage from '$lib/server/storage/s3';
import { processImage } from '$lib/server/storage/images';
import { possibleKeys, purgeObjects, type StoredVariant } from '$lib/server/storage/purge';
import { kindOf, uploadRefusal } from '$lib/records/files';
import { formatBytes } from '$lib/records/organization';
import type { Visibility } from '$lib/records/storage';
import type { FileListItem, StorageUsage, UploadTicket } from '$lib/viewmodels/file';
import { applicationOrThrow, assertStorageEnabled, folderOrThrow } from './folderService';

// Files of a folder of the ACTIVE organization (ctx from the session — DECISIONS.md §13).
//
// Upload (§5): 1. the console asks for a ticket — type, size and QUOTA are checked, the declared
// size is RESERVED (counted as used) and a presigned URL returned; 2. the browser PUTs the original
// straight to the PRIVATE bucket (never public, even briefly); 3. the console confirms — the hub
// checks what was received, builds the processed versions in the folder's bucket, deletes the
// original and replaces the reservation by the real size.

/** Where an organization's files live: one prefix per file, keys never reused. */
const prefixOf = (organizationId: string, applicationId: string, fileId: string) =>
	`orgs/${organizationId}/apps/${applicationId}/files/${fileId}/`;
const originalKeyOf = (organizationId: string, fileId: string) => `tmp/${organizationId}/${fileId}`;

export async function usage(ctx: OrgContext): Promise<StorageUsage> {
	return {
		usedBytes: Number(await fileRepo.usedBytes(ctx.organization.id)),
		quotaBytes: ctx.organization.quotaBytes
	};
}

export async function requestUpload(
	ctx: OrgContext,
	applicationId: string,
	input: { folderId: string; name: string; size: number; contentType: string }
): Promise<UploadTicket> {
	assertCan(ctx, 'files.write');
	assertStorageEnabled(ctx);
	const refusal = uploadRefusal({ type: input.contentType, size: input.size });
	if (refusal) throw new HubError(refusal);
	const kind = kindOf(input.contentType)!;
	await applicationOrThrow(ctx, applicationId);
	const folder = await folderOrThrow(ctx, applicationId, input.folderId);

	const organizationId = ctx.organization.id;
	const fileId = randomUUID();
	const originalKey = originalKeyOf(organizationId, fileId);

	await prisma.$transaction(async (tx) => {
		await fileRepo.lockOrganization(tx, organizationId);
		const used = await fileRepo.usedBytes(organizationId, tx);
		// Strict block at the quota (§10): the member must free space or move to a higher plan.
		if (used + BigInt(input.size) > BigInt(ctx.organization.quotaBytes)) {
			throw new HubError(
				`Espace de stockage insuffisant : ${formatBytes(Number(used))} utilisés sur ${formatBytes(ctx.organization.quotaBytes)}. ` +
					'Supprimez des fichiers ou passez à un forfait supérieur.'
			);
		}
		await fileRepo.createUploadingFile(tx, {
			id: fileId,
			organizationId,
			applicationId,
			folderId: folder.id,
			name: input.name,
			kind,
			visibility: folder.visibility,
			storagePrefix: prefixOf(organizationId, applicationId, fileId),
			originalKey,
			bytes: BigInt(input.size),
			uploadedById: ctx.userId
		});
	});

	const uploadUrl = await storage.presignUpload('PRIVATE', originalKey, input.contentType, input.size);
	return { fileId, uploadUrl, contentType: input.contentType };
}

/** Build and store the processed versions of a received original. */
async function processOriginal(file: {
	kind: string;
	visibility: Visibility;
	storagePrefix: string;
	originalKey: string;
}): Promise<{ variants: StoredVariant[]; width: number | null; height: number | null }> {
	const original = await storage.getObjectBytes('PRIVATE', file.originalKey);
	if (file.kind === 'PDF') {
		const key = `${file.storagePrefix}document.pdf`;
		await storage.putObject(file.visibility, key, original, 'application/pdf');
		return { variants: [{ name: 'document', key, contentType: 'application/pdf', bytes: original.byteLength }], width: null, height: null };
	}
	const versions = await processImage(original);
	const variants: StoredVariant[] = [];
	for (const v of versions) {
		const key = `${file.storagePrefix}${v.name}.webp`;
		await storage.putObject(file.visibility, key, v.body, 'image/webp');
		variants.push({ name: v.name, key, contentType: 'image/webp', bytes: v.body.byteLength, width: v.width, height: v.height });
	}
	const large = variants.at(-1)!;
	return { variants, width: large.width ?? null, height: large.height ?? null };
}

export async function completeUpload(ctx: OrgContext, applicationId: string, fileId: string): Promise<void> {
	assertCan(ctx, 'files.write');
	const organizationId = ctx.organization.id;
	const file = await fileRepo.findFile(organizationId, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	if (file.status !== 'UPLOADING' || !file.originalKey) throw new HubError('Ce fichier a déjà été traité.');

	const received = await storage.headObject('PRIVATE', file.originalKey);
	if (!received) throw new HubError("Le fichier n'a pas été reçu. Réessayez l'envoi.");
	await fileRepo.updateFile(organizationId, fileId, { status: 'PROCESSING' });

	try {
		const { variants, width, height } = await processOriginal({ ...file, originalKey: file.originalKey });
		await fileRepo.updateFile(organizationId, fileId, {
			status: 'READY',
			variants,
			width,
			height,
			// The reservation becomes the real size of what is kept (§10).
			bytes: BigInt(variants.reduce((sum, v) => sum + v.bytes, 0)),
			originalKey: null
		});
	} catch (err) {
		console.error(`[files] processing ${fileId} failed`, err);
		await storage.deleteObjects(file.visibility, possibleKeys(file.storagePrefix)).catch(() => {});
		await fileRepo.updateFile(organizationId, fileId, {
			status: 'FAILED',
			error: 'Fichier illisible ou corrompu.',
			bytes: 0n,
			originalKey: null
		});
	}
	await storage.deleteObjects('PRIVATE', [file.originalKey]).catch(() => {});
}

/** URL of one version: the stable public URL, or a 5-minute signed link for a private file. */
async function urlOf(visibility: Visibility, variant: StoredVariant | undefined) {
	if (!variant) return null;
	return visibility === 'PUBLIC' ? storage.publicUrl(variant.key) : storage.presignDownload('PRIVATE', variant.key);
}

export async function listFiles(ctx: OrgContext, folderId: string): Promise<FileListItem[]> {
	assertCan(ctx, 'read');
	const rows = await fileRepo.listFilesInFolder(ctx.organization.id, folderId);
	return Promise.all(
		rows.map(async (f) => {
			const variants = f.variants as StoredVariant[];
			const thumb = variants.find((v) => v.name === 'thumb');
			const full = variants.find((v) => v.name === 'large') ?? variants.find((v) => v.name === 'document');
			return {
				id: f.id,
				name: f.name,
				kind: f.kind,
				status: f.status,
				bytes: Number(f.bytes),
				width: f.width,
				height: f.height,
				error: f.error,
				createdAt: f.createdAt,
				thumbUrl: await urlOf(f.visibility, thumb),
				viewUrl: await urlOf(f.visibility, full),
				publicUrl: f.visibility === 'PUBLIC' && full ? storage.publicUrl(full.key) : null
			};
		})
	);
}

/** Delete a file: its objects first, then the row (its bytes are freed at once — §10). */
export async function deleteFile(ctx: OrgContext, applicationId: string, fileId: string): Promise<void> {
	assertCan(ctx, 'files.write');
	const file = await fileRepo.findFile(ctx.organization.id, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	await purgeObjects([file]);
	await fileRepo.deleteFile(ctx.organization.id, fileId);
}
