import { apiRoute, jsonBody } from '$lib/server/api/handler';
import { createUpload } from '$lib/server/services/apiFileService';

// POST /api/v1/uploads (secret key) — reserve an upload, get the signed URL to PUT the file to.
export const POST = apiRoute(async (ctx, { request }) => createUpload(ctx, await jsonBody(request)), { status: 201 });
