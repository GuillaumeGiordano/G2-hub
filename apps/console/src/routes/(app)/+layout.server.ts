import { can } from '$lib/records/organization';
import { isSuperadmin } from '$lib/records/roles';
import type { NavContext } from '$lib/records/navigation';
import type { LayoutServerLoad } from './$types';

// Access (signed in + mandatory 2FA + active organization for (org) pages) is enforced centrally
// in hooks.server.ts; here the user, its active organization and its navigation rights are
// surfaced to the pages (the user is guaranteed non-null by the hook).
export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.user!;
	const superadmin = isSuperadmin(user.role);
	const organization = locals.organization;
	const nav: NavContext = {
		isSuperadmin: superadmin,
		hasOrganization: !!organization,
		canManageMembers: !!organization && can(organization.role, superadmin, 'members.manage'),
		storageEnabled: !!organization?.storageEnabled
	};
	return { user, organization, isSuperadmin: superadmin, nav };
};
