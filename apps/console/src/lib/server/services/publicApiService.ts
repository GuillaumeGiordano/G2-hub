import * as folderRepo from '$lib/server/repositories/folderRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import { ApiError, type ApiContext } from '$lib/server/api/auth';
import * as storage from '$lib/server/storage/s3';
import type { StoredVariant } from '$lib/server/storage/purge';
import type { Visibility } from '$lib/records/storage';

// Read side of the public API (/api/v1) — DECISIONS.md §19. Everything is scoped by the KEY's
// organization and application. A publishable key only ever sees PUBLIC folders: a private one is
// answered 404, exactly like a folder that does not exist.

/** A folder as the API returns it. */
export type ApiFolder = { id: string; name: string; path: string; visibility: Visibility };

/** One stored version of a file. */
export type ApiVersion = { url: string; contentType: string; bytes: number; width: number | null; height: number | null };

/** A file as the API returns it (READY files only). */
export type ApiFile = {
	id: string;
	name: string;
	kind: 'IMAGE' | 'VIDEO' | 'PDF';
	width: number | null;
	height: number | null;
	bytes: number;
	createdAt: string;
	/** The main version: largest image, the video, the PDF. */
	url: string;
	/** Small preview: image thumbnail or video poster (null for a PDF). */
	thumbnailUrl: string | null;
	/** Every version by name: thumb / medium / large (image), video / poster, document (PDF). */
	versions: Record<string, ApiVersion>;
};

/** Signed links handed out for private files (secret keys only) stay valid this long. */
const SIGNED_URL_SECONDS = 600;

function assertStorage(ctx: ApiContext) {
	if (!ctx.storageEnabled) throw new ApiError(403, "L'option stockage n'est pas activée pour cette organisation.");
}

const canSee = (ctx: ApiContext, visibility: Visibility) => ctx.kind === 'SECRET' || visibility === 'PUBLIC';

/** Resolve `path` ("Galerie/2026", case-insensitive) or `folder` (an id); none = the app's root. */
async function resolveFolder(ctx: ApiContext, url: URL): Promise<ApiFolder | null> {
	const id = url.searchParams.get('folder');
	const path = url.searchParams.get('path')?.split('/').map((s) => s.trim()).filter(Boolean) ?? [];
	if (id) {
		const f = await folderRepo.findFolder(ctx.organizationId, id);
		if (!f || f.applicationId !== ctx.applicationId || !canSee(ctx, f.visibility)) {
			throw new ApiError(404, 'Dossier introuvable.');
		}
		return { id: f.id, name: f.name, path: await pathOf(ctx, f), visibility: f.visibility };
	}
	let current: ApiFolder | null = null;
	for (const segment of path) {
		const f = await folderRepo.findChildByName(ctx.organizationId, ctx.applicationId, current?.id ?? null, segment);
		if (!f || !canSee(ctx, f.visibility)) throw new ApiError(404, `Dossier introuvable : ${path.join('/')}`);
		current = { id: f.id, name: f.name, path: current ? `${current.path}/${f.name}` : f.name, visibility: f.visibility };
	}
	return current;
}

async function pathOf(ctx: ApiContext, folder: { name: string; parentId: string | null }): Promise<string> {
	const names = [folder.name];
	for (let id = folder.parentId; id; ) {
		const parent = await folderRepo.findFolder(ctx.organizationId, id);
		if (!parent) break;
		names.unshift(parent.name);
		id = parent.parentId;
	}
	return names.join('/');
}

/** GET /api/v1/folders — the folder (if any) and its direct subfolders the key may see. */
export async function listFolders(ctx: ApiContext, url: URL) {
	assertStorage(ctx);
	const folder = await resolveFolder(ctx, url);
	const children = await folderRepo.listChildren(ctx.organizationId, ctx.applicationId, folder?.id ?? null);
	return {
		folder,
		folders: children
			.filter((c) => canSee(ctx, c.visibility))
			.map((c) => ({ id: c.id, name: c.name, path: folder ? `${folder.path}/${c.name}` : c.name, visibility: c.visibility }))
	};
}

async function versionUrl(visibility: Visibility, key: string): Promise<string> {
	return visibility === 'PUBLIC' ? storage.publicUrl(key) : storage.presignDownload('PRIVATE', key, SIGNED_URL_SECONDS);
}

/** GET /api/v1/files — the READY files of a folder (newest first). */
export async function listFiles(ctx: ApiContext, url: URL) {
	assertStorage(ctx);
	const folder = await resolveFolder(ctx, url);
	if (!folder) throw new ApiError(400, 'Précisez un dossier : ?path=Galerie ou ?folder=<id>.');
	const rows = (await fileRepo.listFilesInFolder(ctx.organizationId, folder.id)).filter((f) => f.status === 'READY');

	const files: ApiFile[] = await Promise.all(
		rows.map(async (f) => {
			const versions: Record<string, ApiVersion> = {};
			for (const v of f.variants as StoredVariant[]) {
				versions[v.name] = {
					url: await versionUrl(f.visibility, v.key),
					contentType: v.contentType,
					bytes: v.bytes,
					width: v.width ?? null,
					height: v.height ?? null
				};
			}
			const main = versions.large ?? versions.video ?? versions.document;
			return {
				id: f.id,
				name: f.name,
				kind: f.kind,
				width: f.width,
				height: f.height,
				bytes: Number(f.bytes),
				createdAt: f.createdAt.toISOString(),
				url: main.url,
				thumbnailUrl: (versions.thumb ?? versions.poster)?.url ?? null,
				versions
			};
		})
	);
	return { folder, files };
}
