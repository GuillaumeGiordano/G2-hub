import { createAuthClient } from 'better-auth/svelte';
import { twoFactorClient } from 'better-auth/client/plugins';

// Browser client for sign-in / sign-out and two-factor auth. `twoFactorClient` handles the login
// challenge: on sign-in with 2FA enabled it redirects to /2fa, keeping `redirectTo` (e.g. an Admin
// coming from « Se connecter avec G2 Hub » goes back to /oauth/authorize after the code).
export const authClient = createAuthClient({
	plugins: [
		twoFactorClient({
			onTwoFactorRedirect: () => {
				const to = new URLSearchParams(window.location.search).get('redirectTo');
				window.location.href = to ? `/2fa?redirectTo=${encodeURIComponent(to)}` : '/2fa';
			}
		})
	]
});
