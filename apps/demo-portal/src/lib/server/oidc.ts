import * as oidc from 'openid-client';
import { env } from '$env/dynamic/private';

// The demo portal as an OpenID Connect CLIENT of G2 Hub, with `openid-client` — a certified library
// (any standard OIDC library works the same way: the hub is configured, not integrated). The client
// secret stays on this server; the browser only ever sees the hub's sign-in page and a code.

export const portalUrl = () => env.DEMO_PORTAL_URL || 'http://localhost:5191';
export const redirectUri = () => `${portalUrl()}/auth/callback`;
export const SCOPE = 'openid email profile';

/** Short-lived cookie holding state + nonce + PKCE verifier between /auth/login and /auth/callback. */
export const AUTH_COOKIE = 'portal_auth';

let config: Promise<oidc.Configuration> | null = null;

/** The hub's configuration, discovered from /.well-known/openid-configuration (once per process). */
export function hubConfig(): Promise<oidc.Configuration> | null {
	if (!env.DEMO_PORTAL_CLIENT_ID || !env.DEMO_PORTAL_CLIENT_SECRET) return null;
	const issuer = new URL(env.DEMO_HUB_URL || 'http://localhost:5180');
	config ??= oidc
		.discovery(
			issuer,
			env.DEMO_PORTAL_CLIENT_ID,
			env.DEMO_PORTAL_CLIENT_SECRET,
			undefined,
			// Plain http is refused by the library, except for this local demo.
			issuer.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined
		)
		.catch((err) => {
			config = null; // retry on the next sign-in
			throw err;
		});
	return config;
}
