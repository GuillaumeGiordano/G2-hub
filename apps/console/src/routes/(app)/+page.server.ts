import { redirect } from '@sveltejs/kit';
import { isSuperadmin } from '$lib/records/roles';
import { orgPath } from '$lib/utils/orgPath';
import type { PageServerLoad } from './$types';

// The console's home. An Admin goes straight to its organization's dashboard (/o/<id>); the
// superadmin lands here, outside any organization.
export const load: PageServerLoad = ({ locals }) => {
	if (!isSuperadmin(locals.user!.role)) {
		redirect(303, locals.organization ? orgPath(locals.organization.id) : '/choisir-organisation');
	}
	return { lastOrganization: locals.organization ? { id: locals.organization.id, name: locals.organization.name } : null };
};
