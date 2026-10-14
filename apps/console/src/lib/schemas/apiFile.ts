import { z } from 'zod';

// Bodies of the API write endpoints (secret key) — DECISIONS.md §22.

const alt = z.string().trim().max(300, '300 caractères maximum').nullable().optional();
const caption = z.string().trim().max(500, '500 caractères maximum').nullable().optional();

/** POST /api/v1/uploads — reserve an upload in the folder at `path` (or `folder` id). */
export const apiUploadSchema = z
	.object({
		path: z.string().trim().min(1).optional(),
		folder: z.string().trim().min(1).optional(),
		name: z.string().trim().min(1, 'name requis').max(200, 'name : 200 caractères maximum'),
		size: z.number('size invalide').int('size invalide').positive('size invalide'),
		contentType: z.string().trim().min(1, 'contentType requis'),
		alt,
		caption
	})
	.refine((b) => b.path || b.folder, 'Précisez le dossier : path ou folder.');

/** A user's personal space (§28): « public » (avatar…: public bucket) or « private » (documents:
 *  private bucket, signed links). */
const space = z.enum(['public', 'private'], 'space : public ou private');

/** POST /api/v1/me/uploads — reserve an upload in the signed-in user's personal space. */
export const apiPersonalUploadSchema = z.object({
	space,
	name: z.string().trim().min(1, 'name requis').max(200, 'name : 200 caractères maximum'),
	size: z.number('size invalide').int('size invalide').positive('size invalide'),
	contentType: z.string().trim().min(1, 'contentType requis'),
	alt,
	caption
});

/** GET /api/v1/me/files?space=public|private */
export const apiPersonalQuerySchema = z.object({ space });

/** PATCH /api/v1/files/:id — alternative text and / or caption (null clears it). */
export const apiFileTextSchema = z.object({ alt, caption });

/** PUT / DELETE /api/v1/files/:id/pins/:ref — the site's label of a use (§23), e.g. "product:42".
 *  In the URL, hence no "/" (letters, digits, `: _ - .`). */
export const apiPinRefSchema = z
	.string()
	.min(1, 'ref requis')
	.max(200, 'ref : 200 caractères maximum')
	.regex(/^[A-Za-z0-9:_.-]+$/, 'ref : lettres, chiffres et : _ - . uniquement');

/** GET /api/v1/media — the application's library (every folder), for a « choose a media » picker. */
export const apiMediaQuerySchema = z.object({
	q: z.string().trim().max(200).optional(),
	kind: z.enum(['IMAGE', 'VIDEO', 'PDF'], 'kind : IMAGE, VIDEO ou PDF').optional(),
	page: z.coerce.number('page invalide').int().min(1).default(1),
	perPage: z.coerce.number('perPage invalide').int().min(1).max(100, 'perPage : 100 maximum').default(24)
});

/** The first message of a failed parse. */
export function firstIssue(error: z.ZodError): string {
	return error.issues[0]?.message ?? 'Requête invalide.';
}
