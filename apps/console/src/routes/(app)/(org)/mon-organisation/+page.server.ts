import { loadFailure } from '$lib/server/http';
import * as organizationService from '$lib/server/services/organizationService';
import type { PageServerLoad } from './$types';

// « Mon organisation » — the active organization's page, for its members (DECISIONS.md §31). The
// (org) group guarantees an active organization: `locals.orgContext` is set (hooks.server.ts).
export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { org: await organizationService.getMyOrganization(locals.orgContext!) };
	} catch (err) {
		loadFailure(err);
	}
};
