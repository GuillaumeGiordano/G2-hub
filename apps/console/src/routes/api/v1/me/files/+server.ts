import { apiGet } from '$lib/server/api/handler';
import { listPersonalFiles } from '$lib/server/services/apiFileService';

// GET /api/v1/me/files?space=public|private (secret key + X-G2-User-Token) — the signed-in user's
// personal files (DECISIONS.md §28).
export const GET = apiGet(listPersonalFiles);
