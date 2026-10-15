import * as fileRepo from '$lib/server/repositories/fileRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import * as storage from '$lib/server/storage/s3';
import type { StoredVariant } from '$lib/server/storage/purge';
import type { Visibility } from '$lib/records/storage';
import type { MediaItem } from '$lib/viewmodels/media';

// One READY file of an application of the ACTIVE organization (ctx from the session — §13), with
// everything the Files tab's viewer needs (§30). Readable by every member.

type MediaRow = Awaited<ReturnType<typeof fileRepo.searchMedia>>[number];

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

/** One media by id (`?media=` of the Files tab), or null. */
export async function getMedia(ctx: OrgContext, applicationId: string, fileId: string): Promise<MediaItem | null> {
	assertCan(ctx, 'read');
	const row = await fileRepo.findMediaById(ctx.organization.id, applicationId, fileId);
	return row ? toMediaItem(row) : null;
}
