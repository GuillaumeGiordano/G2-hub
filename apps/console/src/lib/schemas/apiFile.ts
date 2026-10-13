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

/** PATCH /api/v1/files/:id — alternative text and / or caption (null clears it). */
export const apiFileTextSchema = z.object({ alt, caption });

/** The first message of a failed parse. */
export function firstIssue(error: z.ZodError): string {
	return error.issues[0]?.message ?? 'Requête invalide.';
}
