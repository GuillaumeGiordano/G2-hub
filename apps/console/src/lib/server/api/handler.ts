import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import * as keyRepo from '$lib/server/repositories/apiKeyRepository';
import { HubError } from '$lib/server/errors';
import { ApiError, authenticate, type ApiContext } from './auth';

// Shared plumbing of the /api/v1 endpoints: authentication, CORS, cache headers, error shape
// (`{ error: { status, message } }`). The API is a contract: a breaking change = /api/v2.

function corsHeaders(origin: string | null): Record<string, string> {
	return origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' };
}

/** A business error from the shared core (quota, type…) or an API error → its status + message. */
function failure(err: unknown): { status: number; message: string } {
	if (err instanceof ApiError || err instanceof HubError) return { status: err.status, message: err.message };
	// Unexpected: logged, answered 500 without detail (never a raw error).
	console.error('[api] unexpected error', err);
	return { status: 500, message: 'Erreur interne.' };
}

/**
 * An API endpoint. Reads with a publishable key are cached 60 s by browsers / CDNs (§4); anything
 * else is never cached (signed links to private files, writes). `status`: the success status.
 */
export function apiRoute(
	handle: (ctx: ApiContext, event: RequestEvent) => Promise<unknown>,
	{ status = 200 }: { status?: number } = {}
): RequestHandler {
	return async (event) => {
		let ctx: ApiContext | null = null;
		try {
			ctx = await authenticate(event.request, event.url);
			const data = await handle(ctx, event);
			const cacheable = event.request.method === 'GET' && ctx.kind === 'PUBLISHABLE';
			return json(data, {
				status,
				headers: {
					...corsHeaders(ctx.corsOrigin),
					'cache-control': cacheable ? 'public, max-age=60' : 'private, no-store'
				}
			});
		} catch (err) {
			const e = failure(err);
			return json(
				{ error: e },
				{ status: e.status, headers: { ...corsHeaders(ctx?.corsOrigin ?? null), 'cache-control': 'no-store' } }
			);
		}
	};
}

/** A read endpoint (GET). */
export const apiGet = (handle: (ctx: ApiContext, url: URL) => Promise<unknown>) =>
	apiRoute((ctx, event) => handle(ctx, event.url));

/** The JSON body of a write request, or a 400. */
export async function jsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ApiError(400, 'Corps JSON attendu.');
	}
}

/**
 * CORS preflight (a browser sending `Authorization` asks first). No key is sent with a preflight:
 * it is answered for any origin some application allows; the real request is then checked against
 * ITS application. Only reads are meant for browsers (writes need a secret key, refused there).
 * (Passing a publishable key as `?key=` avoids the preflight entirely.)
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
