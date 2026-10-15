import { apiGet, apiPreflight } from '$lib/server/api/handler';
import { listFolderTree } from '$lib/server/services/publicApiService';

// GET /api/v1/folders/tree — every folder of the application with its full path (secret key only),
// for a site's « folder » select (DECISIONS.md §29).
export const GET = apiGet(listFolderTree);
export const OPTIONS = apiPreflight;
