import type { Prisma } from '@g2-hub/db';
import type { FileKind } from '$lib/records/files';
import type { Visibility } from '$lib/records/storage';
import { prisma } from '$lib/server/db';

// Stored files — Prisma queries only, always scoped by organization (DECISIONS.md §13).

const fileSelect = {
	id: true,
	name: true,
	alt: true,
	caption: true,
	source: true,
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
	createdAt: true,
	/** Uses declared by the site: a pinned file cannot be deleted (§23). */
	pins: { select: { ref: true }, orderBy: { createdAt: 'asc' } }
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

/** Filters of the media library (console and API). `visibility`: PUBLIC for a publishable key. */
export type MediaFilter = { kind?: FileKind; folderIds?: string[]; search?: string; visibility?: Visibility };

/** The media library of an application: READY files, newest first, optionally filtered by kind,
 *  folders (a folder and its subtree) and name. */
function mediaWhere(
	organizationId: string,
	applicationId: string,
	filter: MediaFilter
): Prisma.StoredFileWhereInput {
	return {
		organizationId,
		applicationId,
		status: 'READY',
		...(filter.kind ? { kind: filter.kind } : {}),
		...(filter.folderIds ? { folderId: { in: filter.folderIds } } : {}),
		...(filter.visibility ? { visibility: filter.visibility } : {}),
		...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' } } : {})
	};
}

export function searchMedia(
	organizationId: string,
	applicationId: string,
	filter: MediaFilter,
	page: { skip: number; take: number }
) {
	return prisma.storedFile.findMany({
		where: mediaWhere(organizationId, applicationId, filter),
		orderBy: { createdAt: 'desc' },
		skip: page.skip,
		take: page.take,
		select: { ...fileSelect, folder: { select: { name: true } } }
	});
}

/** One READY file of the application's library, or null. */
export function findMediaById(organizationId: string, applicationId: string, id: string) {
	return prisma.storedFile.findFirst({
		where: { id, organizationId, applicationId, status: 'READY' },
		select: { ...fileSelect, folder: { select: { name: true } } }
	});
}

export function countMedia(
	organizationId: string,
	applicationId: string,
	filter: MediaFilter
) {
	return prisma.storedFile.count({ where: mediaWhere(organizationId, applicationId, filter) });
}

/** Files a SITE uploaded, per application of the organization (deletion warnings, §22). */
export async function countSiteFilesByApplication(organizationId: string): Promise<Map<string, number>> {
	const rows = await prisma.storedFile.groupBy({
		by: ['applicationId'],
		where: { organizationId, source: 'API' },
		_count: { _all: true }
	});
	return new Map(rows.map((r) => [r.applicationId, r._count._all]));
}

/** How many files a SITE uploaded (through the API) under these folders — they cannot be deleted
 *  from the console (§22). */
export function countSiteFilesInFolders(organizationId: string, folderIds: string[]) {
	return prisma.storedFile.count({ where: { organizationId, folderId: { in: folderIds }, source: 'API' } });
}

/** How many files under these folders a site has pinned — they cannot be deleted (§23). */
export function countPinnedFilesInFolders(organizationId: string, folderIds: string[]) {
	return prisma.storedFile.count({ where: { organizationId, folderId: { in: folderIds }, pins: { some: {} } } });
}

// ─── Pins (§23) — the file id was checked against the API key's application first ───

/** Idempotent: pinning twice with the same `ref` keeps one pin. */
export function addPin(fileId: string, ref: string) {
	return prisma.filePin.createMany({ data: [{ fileId, ref }], skipDuplicates: true });
}

/** Idempotent: freeing a `ref` that is not there changes nothing. */
export function removePin(fileId: string, ref: string) {
	return prisma.filePin.deleteMany({ where: { fileId, ref } });
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
		uploadedById: string | null;
		alt: string | null;
		caption: string | null;
		source: 'CONSOLE' | 'API';
		apiKeyId: string | null;
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

// ─── System access (background worker: no session, no organization) ─────────
// Only the media worker calls these: it acts on queued files, never on browser input.

export function findFileForWorker(id: string) {
	return prisma.storedFile.findUnique({ where: { id }, select: fileSelect });
}

export function updateFileForWorker(id: string, data: Prisma.StoredFileUpdateInput) {
	return prisma.storedFile.update({ where: { id }, data, select: { id: true } });
}

/** Uploads started before `before` and never confirmed (tab closed, network lost…). */
export function listAbandonedUploads(before: Date) {
	return prisma.storedFile.findMany({
		where: { status: 'UPLOADING', createdAt: { lt: before } },
		select: { id: true, visibility: true, originalKey: true, variants: true }
	});
}

export function deleteFilesForWorker(ids: string[]) {
	return prisma.storedFile.deleteMany({ where: { id: { in: ids } } });
}

export async function deleteFile(organizationId: string, id: string) {
	const { count } = await prisma.storedFile.deleteMany({ where: { id, organizationId } });
	return count;
}
