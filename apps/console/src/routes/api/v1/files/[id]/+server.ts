import { apiPreflight, apiRoute, jsonBody } from '$lib/server/api/handler';
import { deleteFile, getFile, updateFile } from '$lib/server/services/apiFileService';

// One file of the key's application: read (publishable: public + ready only), update its alt /
// caption or delete it (secret key).
export const GET = apiRoute((ctx, { params }) => getFile(ctx, params.id!));
export const PATCH = apiRoute(async (ctx, { params, request }) => updateFile(ctx, params.id!, await jsonBody(request)));
export const DELETE = apiRoute((ctx, { params }) => deleteFile(ctx, params.id!));
export const OPTIONS = apiPreflight;
