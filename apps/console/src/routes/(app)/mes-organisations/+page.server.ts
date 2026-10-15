import { redirect } from '@sveltejs/kit';
import { isSuperadmin } from '$lib/records/roles';
import * as organizationService from '$lib/server/services/organizationService';
import type { PageServerLoad } from './$types';

// « Mes organisations » (DECISIONS.md §36): an Admin's organizations, as cards — only its own. A
// card opens /o/<id> (access checked by the hook). The full list is the superadmin's.
export const load: PageServerLoad = async ({ locals }) => {
	if (isSuperadmin(locals.user!.role)) redirect(303, '/organisations');
	return { organizations: await organizationService.myOrganizations({ id: locals.user!.id, isSuperadmin: false }) };
};
