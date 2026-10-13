import { json } from '@sveltejs/kit';
import { exchangeCode, OAuthError } from '$lib/server/services/oidcService';
import type { RequestHandler } from './$types';

// Token endpoint (RFC 6749 §3.2): the portal's SERVER exchanges a code for tokens, authenticated by
// its client secret. Exempt from the cross-site form check (hooks.server.ts): it uses no cookie.
const NO_STORE = { 'cache-control': 'no-store', pragma: 'no-cache' };

export const POST: RequestHandler = async ({ request }) => {
	try {
		const type = request.headers.get('content-type') ?? '';
		if (!type.startsWith('application/x-www-form-urlencoded')) {
			throw new OAuthError(400, 'invalid_request', 'Expected application/x-www-form-urlencoded.');
		}
		const form = new URLSearchParams(await request.text());
		return json(await exchangeCode(request, form), { headers: NO_STORE });
	} catch (err) {
		if (!(err instanceof OAuthError)) throw err;
		const headers: Record<string, string> = { ...NO_STORE };
		if (err.status === 401) headers['www-authenticate'] = 'Basic realm="G2 Hub"';
		return json({ error: err.error, error_description: err.message }, { status: err.status, headers });
	}
};
