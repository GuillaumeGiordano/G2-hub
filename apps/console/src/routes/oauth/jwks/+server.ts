import { json } from '@sveltejs/kit';
import { jwks } from '$lib/server/services/oidcService';
import type { RequestHandler } from './$types';

// The PUBLIC keys verifying the ID tokens' signature (never the private one).
export const GET: RequestHandler = async () =>
	json(await jwks(), { headers: { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } });
