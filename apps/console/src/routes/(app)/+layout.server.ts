import { isSuperadmin } from '$lib/records/roles';
import type { NavContext } from '$lib/records/navigation';
import * as applicationService from '$lib/server/services/applicationService';
import type { LayoutServerLoad } from './$types';

// Access (signed in + mandatory 2FA + active organization for (org) pages) is enforced centrally
// in hooks.server.ts; here the user, its active organization and its navigation rights are
// surfaced to the pages (the user is guaranteed non-null by the hook).
export const load: LayoutServerLoad = async ({ locals, params }) => {
	// The organization comes from the address (/o/<id>) through the hook: reading params.org makes
	// SvelteKit rerun this load when it changes — a client-side navigation keeps the old data otherwise.
	void params.org;
	const user = locals.user!;
	const superadmin = isSuperadmin(user.role);
	const organization = locals.organization;
	const apps = locals.orgContext ? await applicationService.applicationIds(locals.orgContext) : [];
	const nav: NavContext = {
		isSuperadmin: superadmin,
		hasOrganization: !!organization,
		organizationId: organization?.id ?? null,
		membershipCount: locals.membershipCount,
		applicationCount: apps.length,
		singleApplicationId: apps.length === 1 ? apps[0] : null
	};
	return { user, organization, isSuperadmin: superadmin, nav };
};
