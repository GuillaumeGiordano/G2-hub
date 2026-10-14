import * as keyRepo from '$lib/server/repositories/apiKeyRepository';
import { hashKey } from '$lib/server/services/apiKeyService';
import { appUserOfAccessToken } from '$lib/server/services/oidcService';
import type { ApiKeyKind } from '$lib/records/apiKeys';

// Authentication of the public API (/api/v1) by API key — DECISIONS.md §19. The key alone tells the
// organization and application: nothing about the tenant is ever taken from the request.

/** Who is calling the API (built from the key, like OrgContext is built from the session). */
export type ApiContext = {
	keyId: string;
	kind: ApiKeyKind;
	organizationId: string;
	applicationId: string;
	storageEnabled: boolean;
	/** The signed-in application user, from `X-G2-User-Token` (their « Se connecter avec G2 Hub »
	 *  access token) — the second proof of the personal-space routes (§28). null without it. */
	appUserId: string | null;
	/** The request's Origin when the application allows it — echoed in the CORS headers. */
	corsOrigin: string | null;
};

export class ApiError extends Error {
	constructor(
		readonly status: 400 | 401 | 403 | 404,
		message: string
	) {
		super(message);
	}
}

/** Writes (and anything touching users) need the SECRET key — server-side only. */
export function requireSecret(ctx: ApiContext): void {
	if (ctx.kind !== 'SECRET') throw new ApiError(403, 'Opération réservée à une clé secrète (côté serveur).');
}

/** A user's personal space needs BOTH proofs: the secret key (which application) and the user's
 *  access token (which user, signed in right now). The user never comes from a request parameter. */
export function requireUser(ctx: ApiContext): string {
	requireSecret(ctx);
	if (!ctx.appUserId) {
		throw new ApiError(401, 'Jeton utilisateur manquant (en-tête X-G2-User-Token : son jeton d’accès « Se connecter avec G2 Hub »).');
	}
	return ctx.appUserId;
}

/** The header carrying the signed-in user's access token (personal spaces, §28). */
export const USER_TOKEN_HEADER = 'x-g2-user-token';

/** Refresh `lastUsedAt` at most this often (no write per request). */
const TOUCH_EVERY_MS = 5 * 60_000;

/** The key of a request: `Authorization: Bearer …`, or `?key=` (publishable keys only — a query
 *  string ends up in logs, which is fine for a public key, never for a secret one). */
function keyOf(request: Request, url: URL): { key: string; fromQuery: boolean } | null {
	const auth = request.headers.get('authorization');
	if (auth?.toLowerCase().startsWith('bearer ')) return { key: auth.slice(7).trim(), fromQuery: false };
	const key = url.searchParams.get('key');
	return key ? { key, fromQuery: true } : null;
}

export async function authenticate(request: Request, url: URL): Promise<ApiContext> {
	const found = keyOf(request, url);
	if (!found) throw new ApiError(401, 'Clé API manquante (Authorization: Bearer … ou ?key=).');

	const row = await keyRepo.findActiveKeyByHash(hashKey(found.key));
	if (!row) throw new ApiError(401, 'Clé API invalide ou révoquée.');

	const origin = request.headers.get('origin');
	if (row.kind === 'SECRET') {
		// A secret key must never live in a browser: refuse it when a browser sent it.
		if (origin) throw new ApiError(403, 'Clé secrète refusée depuis un navigateur : utilisez une clé publique.');
		if (found.fromQuery) throw new ApiError(400, 'Une clé secrète se transmet dans l’en-tête Authorization.');
	}
	// A publishable key from a browser: only from the application's allowed origins. Without Origin
	// (a site rendering on its server) it is accepted — the key only reads public files anyway.
	const allowed = !!origin && row.application.allowedOrigins.includes(origin);
	if (row.kind === 'PUBLISHABLE' && origin && !allowed) {
		throw new ApiError(403, `Origine non autorisée pour cette application : ${origin}`);
	}

	// The user's token only travels with a secret key (server to server); an unusable one is a 401
	// (expired after an hour: the portal signs the user in again), never silently ignored.
	const userToken = request.headers.get(USER_TOKEN_HEADER);
	let appUserId: string | null = null;
	if (userToken) {
		if (row.kind !== 'SECRET') throw new ApiError(403, 'Le jeton utilisateur s’envoie avec une clé secrète (côté serveur).');
		appUserId = await appUserOfAccessToken(userToken.trim(), row.applicationId);
		if (!appUserId) throw new ApiError(401, 'Jeton utilisateur invalide ou expiré : reconnectez l’utilisateur.');
	}

	if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
		keyRepo.touchKey(row.id).catch(() => {});
	}
	return {
		keyId: row.id,
		kind: row.kind,
		organizationId: row.organizationId,
		applicationId: row.applicationId,
		storageEnabled: row.organization.storageEnabled,
		appUserId,
		corsOrigin: allowed ? origin : null
	};
}
