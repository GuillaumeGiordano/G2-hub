import * as orgRepo from '$lib/server/repositories/organizationRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import { ApiError, requireSecret, type ApiContext } from '$lib/server/api/auth';
import { apiFileTextSchema, apiUploadSchema, firstIssue } from '$lib/schemas/apiFile';
import { assertStorage, canSee, resolveFolder, toApiFile, type ApiFile } from './publicApiService';
import { confirmUpload, removeFile, reserveUpload, setFileText } from './fileService';

// Write side of the public API — a client SITE alimenting its gallery from its own admin
// (DECISIONS.md §22). Every write needs the SECRET key (server-side only): the site's server asks for
// an upload ticket, its visitor's browser PUTs the file straight to storage with the signed URL (the
// secret key never leaves the server), then the server confirms and stores the returned file id in
// its own database. The file shows up in the hub's media library, flagged as sent by the site.

/** A file of the key's application, or 404 (another application's / organization's id included). */
async function fileOrThrow(ctx: ApiContext, fileId: string) {
	const file = await fileRepo.findFile(ctx.organizationId, fileId);
	if (!file || file.applicationId !== ctx.applicationId) throw new ApiError(404, 'Fichier introuvable.');
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

/** POST /api/v1/uploads/:id/complete — the file was PUT: process it. An image / PDF comes back
 *  READY; a video comes back PROCESSING (poll GET /api/v1/files/:id). */
export async function completeUpload(ctx: ApiContext, fileId: string): Promise<ApiFile> {
	requireSecret(ctx);
	await fileOrThrow(ctx, fileId);
	await confirmUpload(ctx.organizationId, ctx.applicationId, fileId);
	return toApiFile(await fileOrThrow(ctx, fileId));
}

/** GET /api/v1/files/:id — one file. A publishable key only sees a READY file of a public folder. */
export async function getFile(ctx: ApiContext, fileId: string): Promise<ApiFile> {
	assertStorage(ctx);
	const file = await fileOrThrow(ctx, fileId);
	if (ctx.kind === 'PUBLISHABLE' && (!canSee(ctx, file.visibility) || file.status !== 'READY')) {
		throw new ApiError(404, 'Fichier introuvable.');
	}
	return toApiFile(file);
}

/** PATCH /api/v1/files/:id — set alt and / or caption (null clears; absent = unchanged). */
export async function updateFile(ctx: ApiContext, fileId: string, body: unknown): Promise<ApiFile> {
	requireSecret(ctx);
	const parsed = apiFileTextSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error));
	await setFileText(ctx.organizationId, ctx.applicationId, fileId, parsed.data);
	return toApiFile(await fileOrThrow(ctx, fileId));
}

/** DELETE /api/v1/files/:id — the site removes one of its files (objects + row; space freed). */
export async function deleteFile(ctx: ApiContext, fileId: string): Promise<{ deleted: true }> {
	requireSecret(ctx);
	await removeFile(ctx.organizationId, ctx.applicationId, fileId);
	return { deleted: true };
}
