import { error, redirect } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { dev } from '$app/environment';
import { AUTH_COOKIE, hubConfig } from '$lib/server/oidc';
import { createSession, SESSION_COOKIE } from '$lib/server/sessions';
import { toPortalRole } from '$lib/roles';
import type { RequestHandler } from './$types';

// Step 2: back from the hub with a code. The library checks state + iss, exchanges the code (with
// the client secret and the PKCE verifier) and verifies the ID token: signature (hub's public key),
// issuer, audience, expiry and nonce. Then the portal opens ITS OWN session.
export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = await hubConfig();
	if (!config) error(503, 'Connexion G2 Hub non configurée.');
	const raw = cookies.get(AUTH_COOKIE);
	cookies.delete(AUTH_COOKIE, { path: '/auth' });
	if (!raw) redirect(303, '/?erreur=session');
	const { verifier, state, nonce } = JSON.parse(raw) as { verifier: string; state: string; nonce: string };

	let user;
	try {
		const tokens = await oidc.authorizationCodeGrant(config, url, {
			pkceCodeVerifier: verifier,
			expectedState: state,
			expectedNonce: nonce,
			idTokenExpected: true
		});
		const claims = tokens.claims()!;
		// The ID token already carries name, email and role; /userinfo is called here to exercise the
		// access token. The role is read from the SIGNED ID token, which openid-client has verified.
		const info = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
		user = {
			sub: claims.sub,
			name: String(info.name ?? ''),
			email: String(info.email ?? ''),
			role: toPortalRole(claims.role),
			signedInAt: new Date()
		};
	} catch (err) {
		console.error('[portal] sign-in failed', err);
		redirect(303, `/?erreur=${encodeURIComponent((err as Error).message)}`);
	}

	cookies.set(SESSION_COOKIE, createSession(user), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 8 * 3600
	});
	redirect(303, '/');
};
