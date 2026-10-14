import { apiRoute, jsonBody } from '$lib/server/api/handler';
import { createPersonalUpload } from '$lib/server/services/apiFileService';

// POST /api/v1/me/uploads (secret key + X-G2-User-Token) — reserve an upload in the signed-in user's
// « public » or « private » space (DECISIONS.md §28).
export const POST = apiRoute(async (ctx, { request }) => createPersonalUpload(ctx, await jsonBody(request)), { status: 201 });
