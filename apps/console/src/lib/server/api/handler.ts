import { json, type RequestHandler } from '@sveltejs/kit';
import * as keyRepo from '$lib/server/repositories/apiKeyRepository';
import { ApiError, authenticate, type ApiContext } from './auth';

// Shared plumbing of the /api/v1 endpoints: authentication, CORS, cache headers, error shape
// (`{ error: { status, message } }`). The API is a contract: a breaking change = /api/v2.

function corsHeaders(origin: string | null): Record<string, string> {
	return origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' };
}

/** A read endpoint. Publishable reads are cached 60 s by browsers / CDNs (§4); secret ones never
 *  (they may contain signed links to private files). */
export function apiGet(handle: (ctx: ApiContext, url: URL) => Promise<unknown>): RequestHandler {
	return async ({ request, url }) => {
		let ctx: ApiContext | null = null;
		try {
			ctx = await authenticate(request, url);
			const data = await handle(ctx, url);
			return json(data, {
				headers: {
					...corsHeaders(ctx.corsOrigin),
					'cache-control': ctx.kind === 'PUBLISHABLE' ? 'public, max-age=60' : 'private, no-store'
				}
			});
		} catch (err) {
			// An unexpected failure is logged and answered 500 without detail (never a raw error).
			if (!(err instanceof ApiError)) console.error('[api] unexpected error', err);
			const status = err instanceof ApiError ? err.status : 500;
			const message = err instanceof ApiError ? err.message : 'Erreur interne.';
			return json(
				{ error: { status, message } },
				{ status, headers: { ...corsHeaders(ctx?.corsOrigin ?? null), 'cache-control': 'no-store' } }
			);
		}
	};
}

/**
 * CORS preflight (a browser sending `Authorization` asks first). No key is sent with a preflight:
 * it is answered for any origin some application allows; the real request is then checked against
 * ITS application. (Passing a publishable key as `?key=` avoids the preflight entirely.)
 */
export const apiPreflight: RequestHandler = async ({ request }) => {
	const origin = request.headers.get('origin');
	const allowed = !!origin && (await keyRepo.anyApplicationAllowsOrigin(origin));
	return new Response(null, {
		status: 204,
		headers: allowed
			? {
					...corsHeaders(origin),
					'access-control-allow-methods': 'GET, OPTIONS',
					'access-control-allow-headers': 'authorization',
					'access-control-max-age': '600'
				}
			: corsHeaders(null)
	});
};
