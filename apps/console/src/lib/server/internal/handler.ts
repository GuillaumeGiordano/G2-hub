import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { HubError } from '$lib/server/errors';
import { authenticateInternal, InternalApiError } from './auth';

// Plumbing of the /api/internal/v1 endpoints: token check, JSON answers never cached, the same
// error shape as /api/v1 (`{ error: { status, message } }`). No CORS: server to server only.

const NO_STORE = { 'cache-control': 'no-store' };

/** `withStatus`: `run` answers `{ status, body }` (e.g. 201 for a creation) instead of the body. */
export function internalRoute(
	run: (event: RequestEvent) => Promise<unknown>,
	options: { withStatus?: boolean } = {}
): RequestHandler {
	return async (event) => {
		try {
			authenticateInternal(event.request);
			const result = await run(event);
			if (options.withStatus) {
				const { status, body } = result as { status: number; body: unknown };
				return json(body, { status, headers: NO_STORE });
			}
			return json(result, { headers: NO_STORE });
		} catch (err) {
			if (err instanceof InternalApiError || err instanceof HubError) {
				return json({ error: { status: err.status, message: err.message } }, { status: err.status, headers: NO_STORE });
			}
			console.error('[internal-api] unexpected error', err);
			return json({ error: { status: 500, message: 'Erreur interne.' } }, { status: 500, headers: NO_STORE });
		}
	};
}

/** A JSON body, or a 400. */
export async function internalBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new HubError('Corps JSON invalide.');
	}
}
