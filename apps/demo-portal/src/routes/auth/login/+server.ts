import { error, redirect } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { dev } from '$app/environment';
import { AUTH_COOKIE, hubConfig, redirectUri, SCOPE } from '$lib/server/oidc';
import type { RequestHandler } from './$types';

// Step 1: send the user to the hub's sign-in page. Three random values are kept in a short-lived
// cookie of THIS site (AUTH_COOKIE), to be checked when the user comes back:
//   - state: the answer belongs to a sign-in started here (CSRF);
//   - nonce: the ID token was issued for this sign-in (replay);
//   - PKCE verifier: only this browser's sign-in can redeem the code (its hash goes to the hub).
export const GET: RequestHandler = async ({ cookies }) => {
	const config = await hubConfig();
	if (!config) error(503, 'Connexion G2 Hub non configurée (DEMO_PORTAL_CLIENT_ID / _SECRET).');

	const verifier = oidc.randomPKCECodeVerifier();
	const state = oidc.randomState();
	const nonce = oidc.randomNonce();
	cookies.set(AUTH_COOKIE, JSON.stringify({ verifier, state, nonce }), {
		path: '/auth',
		httpOnly: true,
		sameSite: 'lax', // sent back on the top-level redirect from the hub
		secure: !dev,
		maxAge: 600
	});

	const url = oidc.buildAuthorizationUrl(config, {
		redirect_uri: redirectUri(),
		scope: SCOPE,
		code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
		code_challenge_method: 'S256',
		state,
		nonce
	});
	redirect(303, url.href);
};
