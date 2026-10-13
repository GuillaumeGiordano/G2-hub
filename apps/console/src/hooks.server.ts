import { redirect, type Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { requiresTwoFactor } from '$lib/records/roles';

// Central authorization. `event.route.id` carries the (group) segment — e.g. "/(app)/securite" —
// whereas the URL does not. Guarding by that prefix here covers pages AND `+server.ts` endpoints in
// one place (endpoints bypass layout guards), so a new route under (app) is protected by default.
const PROTECTED_GROUP = '/(app)';

// Where 2FA is set up — reachable before 2FA is enabled, or the setup would be unreachable.
const SECURITY_PATH = '/securite';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	if (event.route.id?.startsWith(PROTECTED_GROUP)) {
		const user = event.locals.user;
		if (!user) {
			redirect(302, `/login?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`);
		}
		if (requiresTwoFactor(user.role) && !user.twoFactorEnabled && event.url.pathname !== SECURITY_PATH) {
			redirect(302, `${SECURITY_PATH}?setup=required`);
		}
	}

	return resolve(event);
};
