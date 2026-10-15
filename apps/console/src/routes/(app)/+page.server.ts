import { redirect } from '@sveltejs/kit';
import { isSuperadmin } from '$lib/records/roles';
import { orgPath } from '$lib/utils/orgPath';
import type { PageServerLoad } from './$types';

// The console's home. An Admin of one organization goes straight to its dashboard (/o/<id>), an
// Admin of several picks one in « Mes organisations »; the superadmin lands here.
export const load: PageServerLoad = ({ locals }) => {
	if (!isSuperadmin(locals.user!.role)) {
		if (locals.membershipCount === 1 && locals.organization) redirect(303, orgPath(locals.organization.id));
		redirect(303, '/mes-organisations');
	}
	return { lastOrganization: locals.organization ? { id: locals.organization.id, name: locals.organization.name } : null };
};
