import { error, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { isSuperadmin, requiresTwoFactor } from '$lib/records/roles';
import {
	membershipsOf,
	resolveActiveOrganization,
	resolveOrganizationOfAddress
} from '$lib/server/services/organizationService';
import { startMediaWorker } from '$lib/server/media/worker';

// One media worker per process: transcodes queued videos and removes abandoned uploads.
export const init: ServerInit = () => {
	startMediaWorker();
};

// Central authorization. `event.route.id` carries the (group) segments — e.g.
// "/(app)/o/[org]/membres" — whereas the URL does not. Guarding by that prefix here covers pages AND
// `+server.ts` endpoints in one place (endpoints bypass layout guards), so a new route is protected
// by default. Finer rights (owner-only actions…) are enforced by the services.
const SIGNED_IN_GROUP = '/(app)';
/** An organization's pages: /o/<organization id>/… — the id is checked against the memberships. */
const ORGANIZATION_ROUTE = '/(app)/o/[org]';

// Where 2FA is set up — reachable before 2FA is enabled, or the setup would be unreachable.
const SECURITY_PATH = '/securite';
const ORGANIZATIONS_PATH = '/organisations';

/** The public API authenticates by API key (lib/server/api), never by session cookie. */
const PUBLIC_API = '/api/v1/';
/** The internal API (G2 WebDev portal) authenticates by the instance token, never by cookie either. */
const INTERNAL_API = '/api/internal/';

/** Called server-to-server by portals (no Origin), authenticated by the client secret — never by a
 *  cookie, so a cross-site form cannot abuse it. */
const CSRF_EXEMPT = new Set(['/oauth/token']);
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

/**
 * CSRF protection (SvelteKit's own check, moved here — see svelte.config.js): a form posted from
 * ANOTHER site would carry the visitor's session cookie; refuse any form submission whose Origin is
 * not this site.
 */
function crossSiteForm(request: Request, url: URL): boolean {
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return false;
	const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
	if (!FORM_TYPES.includes(type)) return false;
	return request.headers.get('origin') !== url.origin && !CSRF_EXEMPT.has(url.pathname);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (crossSiteForm(event.request, event.url)) {
		return new Response(`Cross-site ${event.request.method} form submissions are forbidden`, { status: 403 });
	}
	if (event.url.pathname.startsWith(PUBLIC_API) || event.url.pathname.startsWith(INTERNAL_API)) {
		event.locals.user = null;
		event.locals.session = null;
		event.locals.organization = null;
		event.locals.orgContext = null;
		event.locals.requiresTwoFactor = false;
		return resolve(event);
	}

	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;
	event.locals.organization = null;
	event.locals.orgContext = null;
	event.locals.requiresTwoFactor = false;
	event.locals.membershipCount = 0;

	if (session) {
		// The active organization comes from the SESSION, re-checked against the memberships on
		// every request — never from a browser parameter (DECISIONS.md §13).
		const actor = { id: session.user.id, isSuperadmin: isSuperadmin(session.user.role) };
		const memberships = await membershipsOf(actor.id);
		// On an organization's page, the organization is the one of the ADDRESS — re-checked here
		// against the memberships, on every request; anywhere else, the last one opened (§13).
		const organization = (event.route.id ?? '').startsWith(ORGANIZATION_ROUTE)
			? await resolveOrganizationOfAddress(session.session, actor, memberships, event.params.org ?? '')
			: await resolveActiveOrganization(session.session, actor, memberships);
		event.locals.organization = organization;
		event.locals.orgContext = organization
			? { userId: actor.id, isSuperadmin: actor.isSuperadmin, organization }
			: null;
		event.locals.requiresTwoFactor = requiresTwoFactor(session.user.role, memberships.length > 0);
		event.locals.membershipCount = memberships.length;
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
		// Not a member (or no such organization): 404, never revealing that it exists elsewhere.
		if (routeId.startsWith(ORGANIZATION_ROUTE) && !event.locals.organization) {
			error(404, 'Organisation introuvable.');
		}
	}

	return resolve(event);
};
