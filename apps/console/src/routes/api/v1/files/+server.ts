import { apiGet, apiPreflight } from '$lib/server/api/handler';
import { listFiles } from '$lib/server/services/publicApiService';

// GET /api/v1/files?path=Galerie/2026 (or ?folder=<id>) — the folder's READY files.
export const GET = apiGet(listFiles);
export const OPTIONS = apiPreflight;
