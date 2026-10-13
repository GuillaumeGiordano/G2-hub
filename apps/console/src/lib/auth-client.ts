import { createAuthClient } from 'better-auth/svelte';
import { twoFactorClient } from 'better-auth/client/plugins';

// Browser client for sign-in / sign-out and two-factor auth. `twoFactorClient` handles the login
// challenge: on sign-in with 2FA enabled it redirects to /2fa.
export const authClient = createAuthClient({
	plugins: [
		twoFactorClient({
			onTwoFactorRedirect: () => {
				window.location.href = '/2fa';
			}
		})
	]
});
