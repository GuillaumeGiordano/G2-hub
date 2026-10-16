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
	ORGANIZATION_PARAM,
	SSO_ROLE_CLAIM,
	SSO_SCOPES
} from '$lib/records/sso';
import type { PlatformAccess } from '$lib/records/platform';
import { isSuperadmin } from '$lib/records/roles';
import type { AppUserRole } from '$lib/records/appUsers';
import type { SignInOutcome } from '$lib/records/signIns';
import type { SignInClient } from '$lib/viewmodels/signIn';
import { recordSignIn } from './signInLogService';

// « Se connecter avec G2 Hub » — the OpenID Connect provider (DECISIONS.md §25). Only the
// Authorization Code flow with PKCE, for portals that have a server (confidential clients):
//   1. the portal sends the user to /oauth/authorize (client_id = application id, redirect_uri,
//      state, nonce, code_challenge);
//   2. the user signs in HERE with their account of THAT application (an AppUser) — or, being an
//      Admin of the application's organization already signed in to the console (2FA done),
//      continues with that session (§26) — also, on an application of the platform, an Admin of
//      ANY organization (§38: the client portal, or a tool entered for one organization);
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
	application: { id: string; name: string; organizationId: string; platformAccess: PlatformAccess; authEnabled: boolean };
	/** The organization a console member enters a TOOL for (§38), as the tool asked — checked later. */
	organizationId: string | null;
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
	// A client's application needs its organization's Auth offer (§12); the platform's do not.
	if (!client || (client.platformAccess === 'NONE' && !client.organization.authEnabled)) {
		return { kind: 'fatal', message: "Cette application n'existe pas ou n'accepte pas la connexion avec G2 Hub." };
	}
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
			application: {
				id: client.id,
				name: client.name,
				organizationId: client.organizationId,
				platformAccess: client.platformAccess,
				authEnabled: client.organization.authEnabled
			},
			organizationId: params.get(ORGANIZATION_PARAM) || null,
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

/** Check the password; on success issue a code and return where to send the user back. Every
 *  attempt goes to the application's sign-in log (§40) — the answer stays the same for an unknown
 *  address and a wrong password. */
export async function signIn(
	request: AuthorizeRequest,
	email: string,
	password: string,
	client: SignInClient
): Promise<SignInResult> {
	const normalized = email.trim().toLowerCase();
	const key = `${request.application.id}:${normalized}`;
	// Application users belong to the Auth offer of the organization owning the application (§12).
	if (!request.application.authEnabled) return { ok: false, message: 'E-mail ou mot de passe incorrect.' };
	const log = (outcome: SignInOutcome, appUserId: string | null = null) =>
		recordSignIn({
			organizationId: request.application.organizationId,
			applicationId: request.application.id,
			appUserId,
			email: normalized,
			outcome,
			method: 'PASSWORD',
			client
		});
	if (tooManyFailures(key)) {
		log('TOO_MANY_ATTEMPTS');
		return { ok: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' };
	}

	const user = await userRepo.findAppUserByEmail(request.application.id, normalized);
	let valid = false;
	if (user?.passwordHash) valid = await verifyPassword(password, user.passwordHash);
	else await verifyPassword(password, await (decoyHash ??= hashPassword(token())));
	if (!user || !valid) {
		recordFailure(key);
		log(!user ? 'UNKNOWN_ACCOUNT' : !user.passwordHash ? 'NOT_ACTIVATED' : 'WRONG_PASSWORD', user?.id ?? null);
		return { ok: false, message: 'E-mail ou mot de passe incorrect.' };
	}
	if (user.disabledAt) {
		log('DISABLED', user.id);
		return { ok: false, message: 'Ce compte est désactivé. Contactez le responsable du portail.' };
	}
	failures.delete(key);
	log('SUCCESS', user.id);

	const location = await issueCode(request, { appUserId: user.id }, new Date());
	await oidcRepo.touchLastLogin(user.id);
	return { ok: true, location };
}

// ─── Console members (§26, §38) ──────────────────────────────────────────────

type ConsoleAccount = NonNullable<Awaited<ReturnType<typeof oidcRepo.findConsoleAccount>>>;
type Organization = { id: string; name: string };

/** What a console member gets in an application: the `role` sent and, for a TOOL, the
 *  organizations they may enter it for (null: the sign-in is not bound to an organization). */
type ConsoleGrant = {
	role: typeof SSO_ROLE_CLAIM.ADMIN | typeof SSO_ROLE_CLAIM.CLIENT;
	organizations: Organization[] | null;
};

/**
 * Whether a console account may enter an application with its session, and how — THE rule, read at
 * sign-in and again at every use of a code or token:
 * - a client's application (NONE): the Admins of its organization, as `admin` (§26) — not the
 *   superadmin, whom the client invites if needed;
 * - the client portal (ALL_ADMINS): every Admin of any organization, as `client` — `admin` for
 *   the superadmin and the Admins of the organization owning it (§38);
 * - a tool (PER_ORGANIZATION): an Admin, FOR one of their organizations the tool is enabled for;
 *   the superadmin for any organization (§38). Never across organizations.
 */
async function consoleGrant(
	account: ConsoleAccount,
	application: { id: string; organizationId: string; platformAccess: PlatformAccess; authEnabled: boolean }
): Promise<ConsoleGrant | null> {
	if (account.disabledAt) return null;
	const superadmin = isSuperadmin(account.role);
	const organizations = account.memberships.map((m) => m.organization);
	const owner = organizations.some((o) => o.id === application.organizationId);
	const role = superadmin || owner ? SSO_ROLE_CLAIM.ADMIN : SSO_ROLE_CLAIM.CLIENT;

	switch (application.platformAccess) {
		case 'NONE':
			// Without the Auth offer, no back-office through the hub either (§12).
			return owner && application.authEnabled ? { role: SSO_ROLE_CLAIM.ADMIN, organizations: null } : null;
		case 'ALL_ADMINS':
			return superadmin || organizations.length ? { role, organizations: null } : null;
		case 'PER_ORGANIZATION': {
			if (superadmin) return { role, organizations: await oidcRepo.listOrganizations() };
			const enabled = await oidcRepo.findToolOrganizationIds(application.id);
			const allowed = organizations.filter((o) => o.id === application.organizationId || enabled.has(o.id));
			return allowed.length ? { role, organizations: allowed } : null;
		}
	}
}

export type ConsoleSignIn = {
	name: string;
	twoFactorEnabled: boolean;
	role: ConsoleGrant['role'];
	/** A tool: the organizations to choose from (only the requested one when it is allowed). */
	organizations: Organization[] | null;
	/** The tool asked for an organization the member may not enter it for. */
	requestedUnavailable: boolean;
};

/** « Continuer en tant que … »: offered to a console member signed in to the hub who may enter the
 *  requesting application, else null. */
export async function consoleSignIn(request: AuthorizeRequest, userId: string): Promise<ConsoleSignIn | null> {
	const account = await oidcRepo.findConsoleAccount(userId);
	const grant = account && (await consoleGrant(account, request.application));
	if (!account || !grant) return null;
	const requested = grant.organizations?.find((o) => o.id === request.organizationId);
	return {
		name: account.name,
		twoFactorEnabled: account.twoFactorEnabled,
		role: grant.role,
		organizations: requested ? [requested] : grant.organizations,
		requestedUnavailable: !!request.organizationId && !!grant.organizations && !requested
	};
}

/**
 * Continue with the console session (`signedInAt` = when, for `auth_time`), for `organizationId`
 * when the application is a tool. Their 2FA must be on — it is mandatory for every member, and the
 * session then proves it was used.
 */
export async function signInAsConsoleMember(
	request: AuthorizeRequest,
	userId: string,
	signedInAt: Date,
	organizationId: string | null,
	client: SignInClient
): Promise<SignInResult> {
	const account = await oidcRepo.findConsoleAccount(userId);
	const grant = account && (await consoleGrant(account, request.application));
	if (!account || !grant) return { ok: false, message: "Votre compte n'a pas accès à cette application." };
	if (!account.twoFactorEnabled) {
		return { ok: false, message: 'Activez d’abord la double authentification dans la console (page Sécurité).' };
	}
	const organization = grant.organizations?.find((o) => o.id === organizationId) ?? null;
	if (grant.organizations && !organization) {
		return { ok: false, message: 'Choisissez une organisation pour laquelle cet outil est activé.' };
	}
	// In the log of the application (its owner's), like an application user's sign-in (§40).
	recordSignIn({
		organizationId: request.application.organizationId,
		applicationId: request.application.id,
		userId: account.id,
		email: account.email,
		outcome: 'SUCCESS',
		method: 'CONSOLE_SESSION',
		client
	});
	const holder = organization ? { userId: account.id, organizationId: organization.id } : { userId: account.id };
	return { ok: true, location: await issueCode(request, holder, signedInAt) };
}

/** Store a single-use code for `holder` and return the portal URL carrying it. */
async function issueCode(
	request: AuthorizeRequest,
	holder: Holder['ref'],
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
	/** A tool: the organization it was entered for (§38). */
	organization: Organization | null;
	/** The client portal: the organizations the member is an Admin of (§38). */
	organizations: Organization[] | null;
	/** To issue the access token to the same holder (and for the same organization). */
	ref: { appUserId: string } | { userId: string; organizationId?: string };
};

type HolderRow = {
	appUser: { id: string; email: string; name: string; role: AppUserRole; passwordHash: string | null; disabledAt: Date | null } | null;
	user: { id: string; email: string; name: string } | null;
	organizationId: string | null;
};

/**
 * The holder of a code / token if they may STILL use it, else null: an application user not
 * disabled, or a console member who still passes `consoleGrant` — for the SAME organization on a
 * tool. Removing a member from an organization, or disabling a tool for it, thus cuts the access
 * at once (§26, §38).
 */
async function activeHolder(row: HolderRow, applicationId: string): Promise<Holder | null> {
	const found = await oidcRepo.findPlatformApplication(applicationId);
	if (!found) return null;
	const application = { ...found, authEnabled: found.organization.authEnabled };
	if (row.appUser) {
		const u = row.appUser;
		if (u.disabledAt || !u.passwordHash || !application.authEnabled) return null;
		return {
			sub: u.id,
			email: u.email,
			name: u.name,
			role: SSO_ROLE_CLAIM[u.role],
			organization: null,
			organizations: null,
			ref: { appUserId: u.id }
		};
	}
	if (!row.user) return null;
	const account = await oidcRepo.findConsoleAccount(row.user.id);
	const grant = account && (await consoleGrant(account, application));
	if (!account || !grant) return null;

	let organization: Organization | null = null;
	if (grant.organizations) {
		organization = grant.organizations.find((o) => o.id === row.organizationId) ?? null;
		if (!organization) return null;
	} else if (row.organizationId) return null;

	return {
		sub: MEMBER_SUBJECT_PREFIX + account.id,
		email: account.email,
		name: account.name,
		role: grant.role,
		organization,
		// Only the client portal learns them: a client's application never sees the OTHER
		// organizations of its Admin (§38).
		organizations: application.platformAccess === 'ALL_ADMINS' ? account.memberships.map((m) => m.organization) : null,
		ref: organization ? { userId: account.id, organizationId: organization.id } : { userId: account.id }
	};
}

/** The holder's claims: `role` always (§26), the others as the granted scopes allow. Application
 *  users' addresses are only ever set by an e-mailed link they opened, and console accounts are
 *  created the same way, hence `email_verified`. */
function claimsFor(scopes: string[], holder: Holder) {
	return {
		role: holder.role,
		...(scopes.includes('email') && { email: holder.email, email_verified: true }),
		...(scopes.includes('profile') && { name: holder.name }),
		...(scopes.includes('organization') && holder.organization && { organization: holder.organization }),
		...(scopes.includes('organizations') && holder.organizations && { organizations: holder.organizations })
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
