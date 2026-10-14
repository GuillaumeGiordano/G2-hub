import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prisma } from '$lib/server/db';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import * as jobRepo from '$lib/server/repositories/mediaJobRepository';
import { processVideo } from '$lib/server/media/video';
import { wakeWorker } from '$lib/server/media/signal';
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

/** Where the reserved file goes and who sends it (console member or site API key). */
export type UploadScope = {
	organizationId: string;
	applicationId: string;
	quotaBytes: number;
	folder: { id: string; visibility: Visibility };
	uploadedById: string | null;
	apiKeyId: string | null;
};

export type UploadInput = {
	name: string;
	size: number;
	contentType: string;
	alt?: string | null;
	caption?: string | null;
};

/**
 * Core of an upload ticket, shared by the console and the API (callers check rights first): type and
 * size rules, then — under a lock on the organization — the QUOTA, and the declared size is reserved.
 */
export async function reserveUpload(scope: UploadScope, input: UploadInput): Promise<UploadTicket> {
	const refusal = uploadRefusal({ type: input.contentType, size: input.size });
	if (refusal) throw new HubError(refusal);
	const kind = kindOf(input.contentType)!;
	const { organizationId, applicationId, quotaBytes } = scope;
	const fileId = randomUUID();
	const originalKey = originalKeyOf(organizationId, fileId);

	await prisma.$transaction(async (tx) => {
		await fileRepo.lockOrganization(tx, organizationId);
		const used = await fileRepo.usedBytes(organizationId, tx);
		// Strict block at the quota (§10): free space or move to a higher plan.
		if (used + BigInt(input.size) > BigInt(quotaBytes)) {
			throw new HubError(
				`Espace de stockage insuffisant : ${formatBytes(Number(used))} utilisés sur ${formatBytes(quotaBytes)}. ` +
					'Supprimez des fichiers ou passez à un forfait supérieur.'
			);
		}
		await fileRepo.createUploadingFile(tx, {
			id: fileId,
			organizationId,
			applicationId,
			folderId: scope.folder.id,
			name: input.name,
			kind,
			visibility: scope.folder.visibility,
			storagePrefix: prefixOf(organizationId, applicationId, fileId),
			originalKey,
			bytes: BigInt(input.size),
			uploadedById: scope.uploadedById,
			alt: input.alt || null,
			caption: input.caption || null,
			source: scope.apiKeyId ? 'API' : 'CONSOLE',
			apiKeyId: scope.apiKeyId
		});
	});

	const uploadUrl = await storage.presignUpload('PRIVATE', originalKey, input.contentType, input.size);
	return { fileId, uploadUrl, contentType: input.contentType };
}

/** Console: a member uploads into a folder of the active organization. */
export async function requestUpload(
	ctx: OrgContext,
	applicationId: string,
	input: { folderId: string } & UploadInput
): Promise<UploadTicket> {
	assertCan(ctx, 'files.write');
	assertStorageEnabled(ctx);
	await applicationOrThrow(ctx, applicationId);
	const folder = await folderOrThrow(ctx, applicationId, input.folderId);
	return reserveUpload(
		{
			organizationId: ctx.organization.id,
			applicationId,
			quotaBytes: ctx.organization.quotaBytes,
			folder,
			uploadedById: ctx.userId,
			apiKeyId: null
		},
		input
	);
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

/** Console: confirm an upload of the active organization. */
export async function completeUpload(ctx: OrgContext, applicationId: string, fileId: string): Promise<void> {
	assertCan(ctx, 'files.write');
	await confirmUpload(ctx.organization.id, applicationId, fileId);
}

/** Core of a confirmation, shared by the console and the API (callers check rights first): check the
 *  original was received, then process it (an image / PDF now, a video through the worker). */
export async function confirmUpload(organizationId: string, applicationId: string, fileId: string): Promise<void> {
	const file = await fileRepo.findFile(organizationId, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	if (file.status !== 'UPLOADING' || !file.originalKey) throw new HubError('Ce fichier a déjà été traité.');

	const received = await storage.headObject('PRIVATE', file.originalKey);
	if (!received) throw new HubError("Le fichier n'a pas été reçu. Réessayez l'envoi.");
	await fileRepo.updateFile(organizationId, fileId, { status: 'PROCESSING' });

	// A video takes minutes to transcode: queued for the background worker, never in the request.
	if (file.kind === 'VIDEO') {
		await jobRepo.enqueue(fileId);
		wakeWorker();
		return;
	}

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
			const thumb = variants.find((v) => v.name === 'thumb' || v.name === 'poster');
			const full = variants.find((v) => v.name === 'large' || v.name === 'video' || v.name === 'document');
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
				source: f.source,
				pins: f.pins.map((p) => p.ref),
				alt: f.alt,
				caption: f.caption,
				thumbUrl: await urlOf(f.visibility, thumb),
				viewUrl: await urlOf(f.visibility, full),
				publicUrl: f.visibility === 'PUBLIC' && full ? storage.publicUrl(full.key) : null
			};
		})
	);
}

/** Core of a deletion: the objects first, then the row (its bytes are freed at once — §10). A file
 *  a site has pinned is refused, from the console AND the API (§23): another card may use it. */
export async function removeFile(organizationId: string, applicationId: string, fileId: string): Promise<void> {
	const file = await fileRepo.findFile(organizationId, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	if (file.pins.length) {
		throw new HubError(
			`Ce fichier est utilisé par le site (${file.pins.map((p) => p.ref).join(', ')}) : il doit d'abord le libérer.`,
			{ status: 409 }
		);
	}
	await purgeObjects([file]);
	await fileRepo.deleteFile(organizationId, fileId);
}

/** Core: the site declares it uses the file (`ref` = its own label, e.g. "product:42"). Idempotent. */
export async function pinFile(organizationId: string, applicationId: string, fileId: string, ref: string): Promise<void> {
	const file = await fileRepo.findFile(organizationId, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	await fileRepo.addPin(file.id, ref);
}

/** Core: the site no longer uses the file for `ref`. Idempotent. */
export async function unpinFile(organizationId: string, applicationId: string, fileId: string, ref: string): Promise<void> {
	const file = await fileRepo.findFile(organizationId, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	await fileRepo.removePin(file.id, ref);
}

/** Console: delete a file — except one a SITE uploaded, which only that site deletes (§22). */
export async function deleteFile(ctx: OrgContext, applicationId: string, fileId: string): Promise<void> {
	assertCan(ctx, 'files.write');
	const file = await fileRepo.findFile(ctx.organization.id, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	if (file.source === 'API') {
		throw new HubError('Ce fichier a été envoyé par le site : il se supprime depuis le site uniquement.', { status: 403 });
	}
	await removeFile(ctx.organization.id, applicationId, fileId);
}

/** Core: set a file's alternative text and caption (empty = none; undefined = unchanged). */
export async function setFileText(
	organizationId: string,
	applicationId: string,
	fileId: string,
	text: { alt?: string | null; caption?: string | null }
): Promise<void> {
	const file = await fileRepo.findFile(organizationId, fileId);
	if (!file || file.applicationId !== applicationId) throw notFound('Fichier introuvable.');
	await fileRepo.updateFile(organizationId, fileId, {
		...(text.alt !== undefined ? { alt: text.alt || null } : {}),
		...(text.caption !== undefined ? { caption: text.caption || null } : {})
	});
}

/** Console: edit a file's alt / caption (any origin — a site's files included, §22). */
export async function updateFileText(
	ctx: OrgContext,
	applicationId: string,
	fileId: string,
	text: { alt?: string | null; caption?: string | null }
): Promise<void> {
	assertCan(ctx, 'files.write');
	await setFileText(ctx.organization.id, applicationId, fileId, text);
}

// ─── Background work (called by the media worker: no session) ───────────────

/** Transcode a queued video: H.264 1080p + poster into the folder's bucket, then drop the original.
 *  Throws on failure — the worker retries, then calls `failVideo`. */
export async function processQueuedVideo(fileId: string): Promise<void> {
	const file = await fileRepo.findFileForWorker(fileId);
	if (!file || file.status !== 'PROCESSING' || !file.originalKey) return; // deleted meanwhile
	const dir = await mkdtemp(join(tmpdir(), 'g2hub-'));
	try {
		// ffmpeg reads the original from a signed link valid for the whole run.
		const sourceUrl = await storage.presignDownload('PRIVATE', file.originalKey, 60 * 60);
		const out = await processVideo(sourceUrl, dir);
		const videoKey = `${file.storagePrefix}video.mp4`;
		const posterKey = `${file.storagePrefix}poster.webp`;
		await storage.putFile(file.visibility, videoKey, out.videoPath, 'video/mp4');
		await storage.putFile(file.visibility, posterKey, out.posterPath, 'image/webp');
		const variants: StoredVariant[] = [
			{
				name: 'video',
				key: videoKey,
				contentType: 'video/mp4',
				bytes: out.videoBytes,
				width: out.width ?? undefined,
				height: out.height ?? undefined
			},
			{ name: 'poster', key: posterKey, contentType: 'image/webp', bytes: out.posterBytes }
		];
		await fileRepo.updateFileForWorker(fileId, {
			status: 'READY',
			variants,
			width: out.width,
			height: out.height,
			// The reservation becomes the real size of what is kept (§10).
			bytes: BigInt(out.videoBytes + out.posterBytes),
			originalKey: null
		});
		await storage.deleteObjects('PRIVATE', [file.originalKey]).catch(() => {});
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
}

/** Give up on a video after the last attempt: FAILED, nothing counted, every object removed. */
export async function failVideo(fileId: string): Promise<void> {
	const file = await fileRepo.findFileForWorker(fileId);
	if (!file) return;
	await storage.deleteObjects(file.visibility, possibleKeys(file.storagePrefix)).catch(() => {});
	if (file.originalKey) await storage.deleteObjects('PRIVATE', [file.originalKey]).catch(() => {});
	await fileRepo.updateFileForWorker(fileId, {
		status: 'FAILED',
		error: 'Vidéo illisible ou format non pris en charge.',
		bytes: 0n,
		originalKey: null
	});
}

/** Uploads never confirmed for an hour (tab closed, network lost): delete them, which also releases
 *  their quota reservation (§10). Returns how many were removed. */
export async function cleanupAbandonedUploads(maxAgeMs = 60 * 60_000): Promise<number> {
	const abandoned = await fileRepo.listAbandonedUploads(new Date(Date.now() - maxAgeMs));
	if (!abandoned.length) return 0;
	await purgeObjects(abandoned);
	await fileRepo.deleteFilesForWorker(abandoned.map((f) => f.id));
	return abandoned.length;
}
