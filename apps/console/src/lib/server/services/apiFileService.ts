import * as orgRepo from '$lib/server/repositories/organizationRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import * as folderRepo from '$lib/server/repositories/folderRepository';
import { ApiError, requireSecret, requireUser, type ApiContext } from '$lib/server/api/auth';
import {
	apiFileTextSchema,
	apiPersonalQuerySchema,
	apiPersonalUploadSchema,
	apiPinRefSchema,
	apiUploadSchema,
	firstIssue
} from '$lib/schemas/apiFile';
import type { Visibility } from '$lib/records/storage';
import { assertStorage, canSee, resolveFolder, toApiFile, type ApiFile } from './publicApiService';
import { confirmUpload, pinFile, removeFile, reserveUpload, setFileText, unpinFile } from './fileService';

// Write side of the public API — a client SITE alimenting its gallery from its own admin
// (DECISIONS.md §22). Every write needs the SECRET key (server-side only): the site's server asks for
// an upload ticket, its visitor's browser PUTs the file straight to storage with the signed URL (the
// secret key never leaves the server), then the server confirms and stores the returned file id in
// its own database. The file shows up in the hub's media library, flagged as sent by the site.

/** A file of the key's application, or 404 (another application's / organization's id included).
 *  A personal file (§28) also needs its OWNER's token (X-G2-User-Token): anyone else gets 404. */
async function fileOrThrow(ctx: ApiContext, fileId: string) {
	const file = await fileRepo.findFile(ctx.organizationId, fileId);
	if (!file || file.applicationId !== ctx.applicationId) throw new ApiError(404, 'Fichier introuvable.');
	if (file.ownerAppUserId && file.ownerAppUserId !== ctx.appUserId) throw new ApiError(404, 'Fichier introuvable.');
	return file;
}

/** POST /api/v1/uploads — reserve an upload (type, size, quota checked; size reserved). */
export async function createUpload(ctx: ApiContext, body: unknown) {
	requireSecret(ctx);
	assertStorage(ctx);
	const parsed = apiUploadSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	const input = parsed.data;
	const folder = await resolveFolder(ctx, { path: input.path, folder: input.folder });
	if (!folder) throw new ApiError(400, 'Précisez le dossier : path ou folder.');
	return ticketFor(ctx, { ...folder, ownerAppUserId: null }, input);
}

/** Reserve the upload into `folder` and hand out the signed URL to PUT the file to. */
async function ticketFor(
	ctx: ApiContext,
	folder: { id: string; visibility: Visibility; ownerAppUserId: string | null },
	input: Parameters<typeof reserveUpload>[1]
) {
	const org = await orgRepo.findOrganizationById(ctx.organizationId);
	if (!org) throw new ApiError(404, 'Organisation introuvable.');

	const ticket = await reserveUpload(
		{
			organizationId: ctx.organizationId,
			applicationId: ctx.applicationId,
			quotaBytes: Number(org.quotaBytes),
			folder,
			uploadedById: null,
			apiKeyId: ctx.keyId
		},
		input
	);
	return {
		fileId: ticket.fileId,
		/** PUT the file's bytes here, with exactly this Content-Type and the declared size. */
		uploadUrl: ticket.uploadUrl,
		contentType: ticket.contentType,
		expiresInSeconds: 15 * 60
	};
}

// ─── Personal spaces (§28) — secret key + the signed-in user's token ─────────

const visibilityOf = (space: 'public' | 'private'): Visibility => (space === 'public' ? 'PUBLIC' : 'PRIVATE');

/** POST /api/v1/me/uploads — reserve an upload in the user's « public » or « private » space
 *  (created on first use). Then PUT the file and confirm with POST /api/v1/uploads/:id/complete,
 *  the user's token still attached. */
export async function createPersonalUpload(ctx: ApiContext, body: unknown) {
	const appUserId = requireUser(ctx);
	assertStorage(ctx);
	const parsed = apiPersonalUploadSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	const { space, ...input } = parsed.data;
	const visibility = visibilityOf(space);
	const root =
		(await folderRepo.findPersonalRoot(ctx.organizationId, appUserId, visibility)) ??
		(await folderRepo.createPersonalRoot({
			organizationId: ctx.organizationId,
			applicationId: ctx.applicationId,
			ownerAppUserId: appUserId,
			visibility
		}));
	return ticketFor(ctx, root, input);
}

/** GET /api/v1/me/files?space=public|private — the READY files of the user's space (newest first);
 *  private ones come with signed links. */
export async function listPersonalFiles(ctx: ApiContext, url: URL): Promise<{ space: string; files: ApiFile[] }> {
	const appUserId = requireUser(ctx);
	assertStorage(ctx);
	const parsed = apiPersonalQuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	const root = await folderRepo.findPersonalRoot(ctx.organizationId, appUserId, visibilityOf(parsed.data.space));
	const rows = root ? (await fileRepo.listFilesInFolder(ctx.organizationId, root.id)).filter((f) => f.status === 'READY') : [];
	return { space: parsed.data.space, files: await Promise.all(rows.map((f) => toApiFile(f, ctx.kind))) };
}

/** POST /api/v1/uploads/:id/complete — the file was PUT: process it. An image / PDF comes back
 *  READY; a video comes back PROCESSING (poll GET /api/v1/files/:id). */
export async function completeUpload(ctx: ApiContext, fileId: string): Promise<ApiFile> {
	requireSecret(ctx);
	await fileOrThrow(ctx, fileId);
	await confirmUpload(ctx.organizationId, ctx.applicationId, fileId);
	return toApiFile(await fileOrThrow(ctx, fileId), ctx.kind);
}

/** GET /api/v1/files/:id — one file. A publishable key only sees a READY file of a public folder. */
export async function getFile(ctx: ApiContext, fileId: string): Promise<ApiFile> {
	assertStorage(ctx);
	const file = await fileOrThrow(ctx, fileId);
	if (ctx.kind === 'PUBLISHABLE' && (!canSee(ctx, file.visibility) || file.status !== 'READY')) {
		throw new ApiError(404, 'Fichier introuvable.');
	}
	return toApiFile(file, ctx.kind);
}

/** PATCH /api/v1/files/:id — set alt and / or caption (null clears; absent = unchanged). */
export async function updateFile(ctx: ApiContext, fileId: string, body: unknown): Promise<ApiFile> {
	requireSecret(ctx);
	const parsed = apiFileTextSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	await fileOrThrow(ctx, fileId);
	await setFileText(ctx.organizationId, ctx.applicationId, fileId, parsed.data);
	return toApiFile(await fileOrThrow(ctx, fileId), ctx.kind);
}

function pinRef(raw: string): string {
	const parsed = apiPinRefSchema.safeParse(raw);
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	return parsed.data;
}

/** PUT /api/v1/files/:id/pins/:ref — the site uses the file (a card…): it can no longer be deleted
 *  until every pin is freed (§23). Idempotent. */
export async function pin(ctx: ApiContext, fileId: string, ref: string): Promise<ApiFile> {
	requireSecret(ctx);
	await fileOrThrow(ctx, fileId);
	await pinFile(ctx.organizationId, ctx.applicationId, fileId, pinRef(ref));
	return toApiFile(await fileOrThrow(ctx, fileId), ctx.kind);
}

/** DELETE /api/v1/files/:id/pins/:ref — the site no longer uses the file for `ref`. Idempotent. */
export async function unpin(ctx: ApiContext, fileId: string, ref: string): Promise<ApiFile> {
	requireSecret(ctx);
	await fileOrThrow(ctx, fileId);
	await unpinFile(ctx.organizationId, ctx.applicationId, fileId, pinRef(ref));
	return toApiFile(await fileOrThrow(ctx, fileId), ctx.kind);
}

/** DELETE /api/v1/files/:id — the site removes one of its files (objects + row; space freed).
 *  409 while the file is pinned (§23). */
export async function deleteFile(ctx: ApiContext, fileId: string): Promise<{ deleted: true }> {
	requireSecret(ctx);
	await fileOrThrow(ctx, fileId);
	await removeFile(ctx.organizationId, ctx.applicationId, fileId);
	return { deleted: true };
}
