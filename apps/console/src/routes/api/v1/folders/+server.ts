import { apiGet, apiPreflight } from '$lib/server/api/handler';
import { listFolders } from '$lib/server/services/publicApiService';

// GET /api/v1/folders?path=Galerie (or ?folder=<id>; none = the application's root).
export const GET = apiGet(listFolders);
export const OPTIONS = apiPreflight;
