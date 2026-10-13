import { redirect, type Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { isSuperadmin, requiresTwoFactor } from '$lib/records/roles';
import { membershipsOf, resolveActiveOrganization } from '$lib/server/services/organizationService';

// Central authorization. `event.route.id` carries the (group) segments — e.g.
// "/(app)/(org)/membres" — whereas the URL does not. Guarding by that prefix here covers pages AND
// `+server.ts` endpoints in one place (endpoints bypass layout guards), so a new route is protected
// by default. Finer rights (owner-only actions…) are enforced by the services.
const SIGNED_IN_GROUP = '/(app)';
/** Pages working on the active organization: without one, pick it first. */
const ORGANIZATION_GROUP = '/(app)/(org)';

// Where 2FA is set up — reachable before 2FA is enabled, or the setup would be unreachable.
const SECURITY_PATH = '/securite';
const ORGANIZATIONS_PATH = '/organisations';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;
	event.locals.organization = null;
	event.locals.orgContext = null;
	event.locals.requiresTwoFactor = false;

	if (session) {
		// The active organization comes from the SESSION, re-checked against the memberships on
		// every request — never from a browser parameter (DECISIONS.md §13).
		const actor = { id: session.user.id, isSuperadmin: isSuperadmin(session.user.role) };
		const memberships = await membershipsOf(actor.id);
		const organization = await resolveActiveOrganization(session.session, actor, memberships);
		event.locals.organization = organization;
		event.locals.orgContext = organization
			? { userId: actor.id, isSuperadmin: actor.isSuperadmin, organization }
			: null;
		event.locals.requiresTwoFactor = requiresTwoFactor(
			session.user.role,
			memberships.some((m) => m.role === 'OWNER')
		);
	}

	const routeId = event.route.id ?? '';
	if (routeId.startsWith(SIGNED_IN_GROUP)) {
		const user = event.locals.user;
		if (!user) {
			redirect(302, `/login?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`);
		}
		if (event.locals.requiresTwoFactor && !user.twoFactorEnabled && event.url.pathname !== SECURITY_PATH) {
			redirect(302, `${SECURITY_PATH}?setup=required`);
		}
		if (routeId.startsWith(ORGANIZATION_GROUP) && !event.locals.organization) {
			redirect(302, ORGANIZATIONS_PATH);
		}
	}

	return resolve(event);
};
