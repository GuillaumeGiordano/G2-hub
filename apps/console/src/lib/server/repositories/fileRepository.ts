import type { Prisma } from '@g2-hub/db';
import type { FileKind } from '$lib/records/files';
import type { Visibility } from '$lib/records/storage';
import { prisma } from '$lib/server/db';

// Stored files — Prisma queries only, always scoped by organization (DECISIONS.md §13).

const fileSelect = {
	id: true,
	name: true,
	kind: true,
	status: true,
	visibility: true,
	storagePrefix: true,
	originalKey: true,
	variants: true,
	bytes: true,
	width: true,
	height: true,
	error: true,
	folderId: true,
	applicationId: true,
	createdAt: true
} as const;

export function findFile(organizationId: string, id: string) {
	return prisma.storedFile.findFirst({ where: { id, organizationId }, select: fileSelect });
}

export function listFilesInFolder(organizationId: string, folderId: string) {
	return prisma.storedFile.findMany({
		where: { organizationId, folderId },
		orderBy: { createdAt: 'desc' },
		select: fileSelect
	});
}

/** Every file under these folders (to purge their objects before deleting a folder tree). */
export function listFilesInFolders(organizationId: string, folderIds: string[]) {
	return prisma.storedFile.findMany({
		where: { organizationId, folderId: { in: folderIds } },
		select: { visibility: true, originalKey: true, variants: true }
	});
}

/** Every file of an application, or of a whole organization (`applicationId` omitted) — to purge
 *  their objects before deleting it. */
export function listFilesForPurge(organizationId: string, applicationId?: string) {
	return prisma.storedFile.findMany({
		where: { organizationId, ...(applicationId ? { applicationId } : {}) },
		select: { visibility: true, originalKey: true, variants: true }
	});
}

/**
 * Lock the organization row for the rest of the transaction (`FOR UPDATE`): two concurrent uploads
 * then check the quota one after the other instead of both seeing the same free space.
 */
export async function lockOrganization(tx: Prisma.TransactionClient, organizationId: string) {
	await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
}

/** Bytes counted toward the quota: stored versions + reservations of in-flight uploads (§10). */
export async function usedBytes(organizationId: string, tx: Prisma.TransactionClient = prisma): Promise<bigint> {
	const agg = await tx.storedFile.aggregate({ where: { organizationId }, _sum: { bytes: true } });
	return agg._sum.bytes ?? 0n;
}

export function createUploadingFile(
	tx: Prisma.TransactionClient,
	data: {
		id: string;
		organizationId: string;
		applicationId: string;
		folderId: string;
		name: string;
		kind: FileKind;
		visibility: Visibility;
		storagePrefix: string;
		originalKey: string;
		bytes: bigint;
		uploadedById: string;
	}
) {
	return tx.storedFile.create({ data, select: { id: true } });
}

/** Returns the number of rows changed (0 = not in this organization). */
export async function updateFile(
	organizationId: string,
	id: string,
	data: Prisma.StoredFileUpdateManyMutationInput
) {
	const { count } = await prisma.storedFile.updateMany({ where: { id, organizationId }, data });
	return count;
}

export async function deleteFile(organizationId: string, id: string) {
	const { count } = await prisma.storedFile.deleteMany({ where: { id, organizationId } });
	return count;
}
