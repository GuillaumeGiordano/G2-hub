import { apiRoute } from '$lib/server/api/handler';
import { completeUpload } from '$lib/server/services/apiFileService';

// POST /api/v1/uploads/:id/complete (secret key) — the file was PUT: process it.
export const POST = apiRoute((ctx, { params }) => completeUpload(ctx, params.id!));
