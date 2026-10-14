import * as fileRepo from '$lib/server/repositories/fileRepository';
import * as folderRepo from '$lib/server/repositories/folderRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { notFound } from '$lib/server/errors';
import * as storage from '$lib/server/storage/s3';
import type { StoredVariant } from '$lib/server/storage/purge';
import { can } from '$lib/records/organization';
import type { FileKind } from '$lib/records/files';
import type { Visibility } from '$lib/records/storage';
import type { MediaFolderOption, MediaItem, MediaLibrary } from '$lib/viewmodels/media';
import { applicationOrThrow } from './folderService';

// Media library of an application of the ACTIVE organization (ctx from the session — §13): every
// READY file, all folders together, to look at them (grid + viewer). Readable by every member.

type MediaRow = Awaited<ReturnType<typeof fileRepo.searchMedia>>[number];

/** "Galerie / 2026" labels, sorted, for the folder filter. */
function folderOptions(folders: { id: string; name: string; parentId: string | null }[]): MediaFolderOption[] {
	const byId = new Map(folders.map((f) => [f.id, f]));
	const pathOf = (id: string): string => {
		const f = byId.get(id)!;
		return f.parentId && byId.has(f.parentId) ? `${pathOf(f.parentId)} / ${f.name}` : f.name;
	};
	return folders
		.map((f) => ({ value: f.id, label: pathOf(f.id) }))
		.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** The downloaded name keeps the uploaded name but the STORED format ("croissant.jpg" → .webp). */
function downloadName(name: string, contentType: string): string {
	const ext = { 'image/webp': 'webp', 'video/mp4': 'mp4', 'application/pdf': 'pdf' }[contentType];
	return ext ? `${name.replace(/\.[^.]+$/, '')}.${ext}` : name;
}

const urlOf = (visibility: Visibility, key: string) =>
	visibility === 'PUBLIC' ? Promise.resolve(storage.publicUrl(key)) : storage.presignDownload('PRIVATE', key);

async function toMediaItem(row: MediaRow): Promise<MediaItem> {
	const variants = row.variants as StoredVariant[];
	const pick = (...names: string[]) => names.map((n) => variants.find((v) => v.name === n)).find(Boolean);
	const main = pick('large', 'video', 'document')!;
	const thumb = pick('thumb', 'poster');
	const poster = pick('poster');
	return {
		id: row.id,
		name: row.name,
		kind: row.kind,
		width: row.width,
		height: row.height,
		bytes: Number(row.bytes),
		createdAt: row.createdAt,
		folderId: row.folderId,
		folderName: row.folder.name,
		visibility: row.visibility,
		source: row.source,
		pins: row.pins.map((p) => p.ref),
		alt: row.alt,
		caption: row.caption,
		thumbUrl: thumb ? await urlOf(row.visibility, thumb.key) : null,
		viewUrl: await urlOf(row.visibility, main.key),
		posterUrl: poster ? await urlOf(row.visibility, poster.key) : null,
		downloadUrl: await storage.presignDownload(row.visibility, main.key, 300, downloadName(row.name, main.contentType)),
		publicUrl: row.visibility === 'PUBLIC' ? storage.publicUrl(main.key) : null
	};
}

export async function listMedia(
	ctx: OrgContext,
	applicationId: string,
	params: { kind?: FileKind; folderId?: string; search?: string; page: number; perPage: number }
): Promise<MediaLibrary> {
	assertCan(ctx, 'read');
	const application = await applicationOrThrow(ctx, applicationId);
	const organizationId = ctx.organization.id;
	const base = {
		application,
		page: params.page,
		perPage: params.perPage,
		canWrite: can(ctx.organization.role, ctx.isSuperadmin, 'files.write'),
		storageEnabled: ctx.organization.storageEnabled
	};
	if (!ctx.organization.storageEnabled) return { ...base, items: [], total: 0, folders: [] };

	const folders = await folderRepo.listAllFolders(organizationId, applicationId);
	// A folder filter covers the folder AND its subfolders; a foreign id is a 404.
	let folderIds: string[] | undefined;
	if (params.folderId) {
		if (!folders.some((f) => f.id === params.folderId)) throw notFound('Dossier introuvable.');
		folderIds = await folderRepo.listSubtreeIds(organizationId, params.folderId);
	}
	const filter = { kind: params.kind, folderIds, search: params.search };
	const [rows, total] = await Promise.all([
		fileRepo.searchMedia(organizationId, applicationId, filter, {
			skip: (params.page - 1) * params.perPage,
			take: params.perPage
		}),
		fileRepo.countMedia(organizationId, applicationId, filter)
	]);
	return { ...base, items: await Promise.all(rows.map(toMediaItem)), total, folders: folderOptions(folders) };
}

/** One media by id (a shared `?media=` link to an item outside the current page), or null. */
export async function getMedia(ctx: OrgContext, applicationId: string, fileId: string): Promise<MediaItem | null> {
	assertCan(ctx, 'read');
	const row = await fileRepo.findMediaById(ctx.organization.id, applicationId, fileId);
	return row ? toMediaItem(row) : null;
}
