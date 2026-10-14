import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT } from 'jose';
import * as oidcRepo from '$lib/server/repositories/oidcRepository';
import * as userRepo from '$lib/server/repositories/appUserRepository';
import { hubUrl } from '$lib/server/instance';
import { signingKey, SIGNING_ALG } from '$lib/server/oidc/keys';
import { hashPassword, verifyPassword } from '$lib/server/passwords';
import {
	ACCESS_TOKEN_TTL,
	AUTH_CODE_TTL,
	ID_TOKEN_TTL,
	MEMBER_SUBJECT_PREFIX,
	SSO_ROLE_CLAIM,
	SSO_SCOPES
} from '$lib/records/sso';
import type { AppUserRole } from '$lib/records/appUsers';

// « Se connecter avec G2 Hub » — the OpenID Connect provider (DECISIONS.md §25). Only the
// Authorization Code flow with PKCE, for portals that have a server (confidential clients):
//   1. the portal sends the user to /oauth/authorize (client_id = application id, redirect_uri,
//      state, nonce, code_challenge);
//   2. the user signs in HERE with their account of THAT application (an AppUser) — or, being an
//      Admin of the application's organization already signed in to the console (2FA done),
//      continues with that session (§26);
//   3. the hub sends them back to redirect_uri with a single-use code (60 s);
//   4. the portal's server exchanges code + code_verifier + client secret at /oauth/token for an
//      ID token (signed JWT: who the user is) and an access token (for /oauth/userinfo).
// Everything is bound to the application: a code or token of application A is useless for B.

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const token = (prefix = '') => prefix + randomBytes(32).toString('base64url');

/** The hub's issuer identifier (`iss`): its public URL. */
export function issuer(): string {
	return hubUrl();
}

/** An OAuth error answered as JSON by the token / userinfo endpoints (RFC 6749 §5.2). */
export class OAuthError extends Error {
	constructor(
		readonly status: 400 | 401,
		readonly error: string,
		description: string
	) {
		super(description);
	}
}

// ─── 1. Authorization request ────────────────────────────────────────────────

export type AuthorizeRequest = {
	application: { id: string; name: string };
	redirectUri: string;
	scope: string[];
	state: string | null;
	nonce: string | null;
	codeChallenge: string;
	loginHint: string | null;
};

export type AuthorizeCheck =
	/** Valid: show the sign-in form. */
	| { kind: 'ok'; request: AuthorizeRequest }
	/** The portal itself is not trusted (unknown client, return URL not registered): NEVER redirect
	 *  to an unverified URL — show the error on the hub. */
	| { kind: 'fatal'; message: string }
	/** The portal is trusted but its request is wrong: send the error back to it. */
	| { kind: 'redirect'; location: string };

/** Where a portal is sent back: its redirect_uri + parameters (+ `iss`, RFC 9207). */
function backTo(redirectUri: string, params: Record<string, string | null>): string {
	const url = new URL(redirectUri);
	for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
	url.searchParams.set('iss', issuer());
	return url.toString();
}

const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export async function checkAuthorizeRequest(params: URLSearchParams): Promise<AuthorizeCheck> {
	const clientId = params.get('client_id') ?? '';
	const client = clientId ? await oidcRepo.findSsoClient(clientId) : null;
	if (!client) return { kind: 'fatal', message: "Cette application n'existe pas ou n'accepte pas la connexion avec G2 Hub." };
	const redirectUri = params.get('redirect_uri') ?? '';
	if (!client.ssoRedirectUris.includes(redirectUri)) {
		return { kind: 'fatal', message: "L'adresse de retour demandée n'est pas autorisée pour cette application." };
	}

	const state = params.get('state');
	const fail = (error: string, description: string): AuthorizeCheck => ({
		kind: 'redirect',
		location: backTo(redirectUri, { error, error_description: description, state })
	});
	if (params.get('response_type') !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported.');
	const scope = (params.get('scope') ?? '').split(' ').filter(Boolean);
	if (!scope.includes('openid')) return fail('invalid_scope', 'The openid scope is required.');
	const codeChallenge = params.get('code_challenge') ?? '';
	if (params.get('code_challenge_method') !== 'S256' || !PKCE_CHALLENGE.test(codeChallenge)) {
		return fail('invalid_request', 'PKCE is required: code_challenge with code_challenge_method=S256.');
	}
	if (params.has('request') || params.has('request_uri')) return fail('request_not_supported', 'Request objects are not supported.');
	// No session is kept on the hub for application users: it can never sign in silently.
	if ((params.get('prompt') ?? '').split(' ').includes('none')) return fail('login_required', 'The user must sign in.');

	return {
		kind: 'ok',
		request: {
			application: { id: client.id, name: client.name },
			redirectUri,
			scope: scope.filter((s) => (SSO_SCOPES as readonly string[]).includes(s)),
			state,
			nonce: params.get('nonce'),
			codeChallenge,
			loginHint: params.get('login_hint')
		}
	};
}

// ─── 2. Sign-in ──────────────────────────────────────────────────────────────

/** Failed sign-ins per (application, e-mail) — in memory: one process per instance. */
const failures = new Map<string, { count: number; since: number }>();
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 5 * 60_000;

function tooManyFailures(key: string): boolean {
	const entry = failures.get(key);
	if (!entry) return false;
	if (Date.now() - entry.since > FAILURE_WINDOW_MS) {
		failures.delete(key);
		return false;
	}
	return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string): void {
	const entry = failures.get(key);
	if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
	else entry.count++;
}

/** A hash verified when the address is unknown, so that the answer takes the same time and does
 *  not reveal whether the account exists. */
let decoyHash: Promise<string> | null = null;

export type SignInResult = { ok: true; location: string } | { ok: false; message: string };

/** Check the password; on success issue a code and return where to send the user back. */
export async function signIn(request: AuthorizeRequest, email: string, password: string): Promise<SignInResult> {
	const normalized = email.trim().toLowerCase();
	const key = `${request.application.id}:${normalized}`;
	if (tooManyFailures(key)) return { ok: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' };

	const user = await userRepo.findAppUserByEmail(request.application.id, normalized);
	let valid = false;
	if (user?.passwordHash) valid = await verifyPassword(password, user.passwordHash);
	else await verifyPassword(password, await (decoyHash ??= hashPassword(token())));
	if (!user || !valid) {
		recordFailure(key);
		return { ok: false, message: 'E-mail ou mot de passe incorrect.' };
	}
	if (user.disabledAt) return { ok: false, message: 'Ce compte est désactivé. Contactez le responsable du portail.' };
	failures.delete(key);

	const location = await issueCode(request, { appUserId: user.id }, new Date());
	await oidcRepo.touchLastLogin(user.id);
	return { ok: true, location };
}

/** The console member if they are an Admin of the requesting application's organization, else null. */
export async function applicationAdmin(request: AuthorizeRequest, userId: string) {
	const admin = await oidcRepo.findApplicationAdmin(userId, request.application.id);
	return admin && { name: admin.name, email: admin.email, twoFactorEnabled: admin.twoFactorEnabled };
}

/**
 * « Continuer en tant qu'admin »: a console member signed in to the hub (`signedInAt` = when, for
 * `auth_time`) who is an Admin of the application's organization (§26). Their 2FA must be on —
 * it is mandatory for every member, and the session then proves it was used.
 */
export async function signInAsAdmin(request: AuthorizeRequest, userId: string, signedInAt: Date): Promise<SignInResult> {
	const admin = await oidcRepo.findApplicationAdmin(userId, request.application.id);
	if (!admin) return { ok: false, message: "Votre compte n'est pas administrateur de cette application." };
	if (!admin.twoFactorEnabled) {
		return { ok: false, message: 'Activez d’abord la double authentification dans la console (page Sécurité).' };
	}
	return { ok: true, location: await issueCode(request, { userId: admin.id }, signedInAt) };
}

/** Store a single-use code for `holder` and return the portal URL carrying it. */
async function issueCode(
	request: AuthorizeRequest,
	holder: { appUserId: string } | { userId: string },
	authTime: Date
): Promise<string> {
	const code = token();
	await oidcRepo.createAuthCode({
		hash: sha256(code),
		applicationId: request.application.id,
		...holder,
		redirectUri: request.redirectUri,
		codeChallenge: request.codeChallenge,
		nonce: request.nonce,
		scope: request.scope.join(' '),
		authTime,
		expiresAt: new Date(Date.now() + AUTH_CODE_TTL * 1000)
	});
	return backTo(request.redirectUri, { code, state: request.state });
}

// ─── 3. Token endpoint ───────────────────────────────────────────────────────

/** The client's credentials: `Authorization: Basic` (client_secret_basic) or the form body
 *  (client_secret_post). */
function clientCredentials(request: Request, form: URLSearchParams): { id: string; secret: string } | null {
	const header = request.headers.get('authorization');
	if (header?.toLowerCase().startsWith('basic ')) {
		const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString();
		const i = decoded.indexOf(':');
		if (i < 0) return null;
		// RFC 6749 §2.3.1: both parts are form-urlencoded before being joined.
		return {
			id: decodeURIComponent(decoded.slice(0, i).replaceAll('+', ' ')),
			secret: decodeURIComponent(decoded.slice(i + 1).replaceAll('+', ' '))
		};
	}
	const id = form.get('client_id');
	const secret = form.get('client_secret');
	return id && secret ? { id, secret } : null;
}

function sameHash(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

/** base64url(SHA-256(verifier)) must equal the challenge sent at step 1 (RFC 7636). */
function pkceMatches(verifier: string, challenge: string): boolean {
	if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
	return sameHash(createHash('sha256').update(verifier).digest('base64url'), challenge);
}

export type TokenResponse = {
	access_token: string;
	token_type: 'Bearer';
	expires_in: number;
	id_token: string;
	scope: string;
};

export async function exchangeCode(request: Request, form: URLSearchParams): Promise<TokenResponse> {
	const credentials = clientCredentials(request, form);
	const client = credentials ? await oidcRepo.findSsoClient(credentials.id) : null;
	if (!credentials || !client?.ssoSecretHash || !sameHash(sha256(credentials.secret), client.ssoSecretHash)) {
		throw new OAuthError(401, 'invalid_client', 'Client authentication failed.');
	}
	if (form.get('grant_type') !== 'authorization_code') {
		throw new OAuthError(400, 'unsupported_grant_type', 'Only authorization_code is supported.');
	}

	const invalidGrant = new OAuthError(400, 'invalid_grant', 'The code is invalid, expired or already used.');
	const code = await oidcRepo.findAuthCode(sha256(form.get('code') ?? ''));
	if (!code || code.applicationId !== client.id || code.usedAt || code.expiresAt <= new Date()) throw invalidGrant;
	if (code.redirectUri !== form.get('redirect_uri')) throw invalidGrant;
	if (!pkceMatches(form.get('code_verifier') ?? '', code.codeChallenge)) throw invalidGrant;
	const holder = await activeHolder(code, client.id);
	if (!holder) throw invalidGrant;
	if (!(await oidcRepo.useAuthCode(code.id))) throw invalidGrant;

	const accessToken = token('g2_at_');
	await oidcRepo.createAccessToken({
		hash: sha256(accessToken),
		applicationId: client.id,
		...holder.ref,
		scope: code.scope,
		expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL * 1000)
	});

	const key = await signingKey();
	const scopes = code.scope.split(' ');
	const idToken = await new SignJWT({
		auth_time: Math.floor(code.authTime.getTime() / 1000),
		...(code.nonce && { nonce: code.nonce }),
		...claimsFor(scopes, holder)
	})
		.setProtectedHeader({ alg: SIGNING_ALG, kid: key.kid, typ: 'JWT' })
		.setIssuer(issuer())
		.setSubject(holder.sub)
		.setAudience(client.id)
		.setIssuedAt()
		.setExpirationTime(`${ID_TOKEN_TTL}s`)
		.sign(key.privateKey);

	return { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL, id_token: idToken, scope: code.scope };
}

/** Who a code / token was issued to, as the portal sees them. */
type Holder = {
	sub: string;
	email: string;
	name: string;
	role: (typeof SSO_ROLE_CLAIM)[keyof typeof SSO_ROLE_CLAIM];
	/** To issue the access token to the same holder. */
	ref: { appUserId: string } | { userId: string };
};

type HolderRow = {
	appUser: { id: string; email: string; name: string; role: AppUserRole; passwordHash: string | null; disabledAt: Date | null } | null;
	user: { id: string; email: string; name: string } | null;
};

/**
 * The holder of a code / token if they may STILL use it, else null: an application user not
 * disabled, or a console member still Admin of the application's organization (§26) — removing a
 * member from the organization thus cuts their access to its applications at once.
 */
async function activeHolder(row: HolderRow, applicationId: string): Promise<Holder | null> {
	if (row.appUser) {
		const u = row.appUser;
		if (u.disabledAt || !u.passwordHash) return null;
		return { sub: u.id, email: u.email, name: u.name, role: SSO_ROLE_CLAIM[u.role], ref: { appUserId: u.id } };
	}
	if (row.user && (await oidcRepo.findApplicationAdmin(row.user.id, applicationId))) {
		const u = row.user;
		return { sub: MEMBER_SUBJECT_PREFIX + u.id, email: u.email, name: u.name, role: SSO_ROLE_CLAIM.ADMIN, ref: { userId: u.id } };
	}
	return null;
}

/** The holder's claims: `role` always (§26), the others as the granted scopes allow. Application
 *  users' addresses are only ever set by an e-mailed link they opened, and console accounts are
 *  created the same way, hence `email_verified`. */
function claimsFor(scopes: string[], holder: Holder) {
	return {
		role: holder.role,
		...(scopes.includes('email') && { email: holder.email, email_verified: true }),
		...(scopes.includes('profile') && { name: holder.name })
	};
}

// ─── 4. UserInfo ─────────────────────────────────────────────────────────────

export async function userInfo(request: Request) {
	const header = request.headers.get('authorization') ?? '';
	const value = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
	const row = value ? await oidcRepo.findAccessToken(sha256(value)) : null;
	const holder = row && row.expiresAt > new Date() ? await activeHolder(row, row.applicationId) : null;
	if (!row || !holder) throw new OAuthError(401, 'invalid_token', 'The access token is invalid or expired.');
	return { sub: holder.sub, ...claimsFor(row.scope.split(' '), holder) };
}

/** The application user an access token was issued to, for THIS application — the second proof
 *  of the personal-space routes (§28), next to the secret key. null when the token is unknown,
 *  expired, issued to another application, to an Admin (no personal space) or to a disabled user. */
export async function appUserOfAccessToken(token: string, applicationId: string): Promise<string | null> {
	if (!token || token.length > 256) return null;
	const row = await oidcRepo.findAccessToken(sha256(token));
	if (!row || row.expiresAt <= new Date() || row.applicationId !== applicationId || !row.appUser) return null;
	const holder = await activeHolder(row, applicationId);
	return holder && 'appUserId' in holder.ref ? holder.ref.appUserId : null;
}

// ─── Discovery ───────────────────────────────────────────────────────────────

export function discoveryDocument() {
	const iss = issuer();
	return {
		issuer: iss,
		authorization_endpoint: `${iss}/oauth/authorize`,
		token_endpoint: `${iss}/oauth/token`,
		userinfo_endpoint: `${iss}/oauth/userinfo`,
		jwks_uri: `${iss}/oauth/jwks`,
		scopes_supported: SSO_SCOPES,
		response_types_supported: ['code'],
		response_modes_supported: ['query'],
		grant_types_supported: ['authorization_code'],
		subject_types_supported: ['public'],
		id_token_signing_alg_values_supported: [SIGNING_ALG],
		token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
		code_challenge_methods_supported: ['S256'],
		claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'auth_time', 'nonce', 'role', 'email', 'email_verified', 'name'],
		authorization_response_iss_parameter_supported: true
	};
}

export async function jwks() {
	return { keys: (await signingKey()).jwks };
}

export const purgeExpiredGrants = () => oidcRepo.purgeExpired();
