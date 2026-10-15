import { apiGet, apiPreflight } from '$lib/server/api/handler';
import { listMedia } from '$lib/server/services/publicApiService';

// GET /api/v1/media?q=&kind=IMAGE&folder=<id>&page=1&perPage=24 — the application's READY files, every folder
// together, for a « choose a media » picker in a site's back-office (DECISIONS.md §23).
export const GET = apiGet(listMedia);
export const OPTIONS = apiPreflight;
