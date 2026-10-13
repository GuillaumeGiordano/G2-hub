import { json } from '@sveltejs/kit';
import { discoveryDocument } from '$lib/server/services/oidcService';
import type { RequestHandler } from './$types';

// OpenID Connect discovery: a portal's OIDC library reads everything else from here (§25).
export const GET: RequestHandler = () =>
	json(discoveryDocument(), { headers: { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } });
