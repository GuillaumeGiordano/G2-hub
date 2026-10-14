import { apiPreflight, apiRoute } from '$lib/server/api/handler';
import { pin, unpin } from '$lib/server/services/apiFileService';

// PUT / DELETE /api/v1/files/:id/pins/:ref (secret key) — the site declares it uses the file for
// `ref` (« product:42 »), or no longer does. A pinned file cannot be deleted (DECISIONS.md §23).
export const PUT = apiRoute((ctx, { params }) => pin(ctx, params.id!, params.ref!));
export const DELETE = apiRoute((ctx, { params }) => unpin(ctx, params.id!, params.ref!));
export const OPTIONS = apiPreflight;
