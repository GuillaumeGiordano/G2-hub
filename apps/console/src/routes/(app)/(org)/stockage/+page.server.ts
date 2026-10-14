import { loadFailure } from '$lib/server/http';
import * as storageService from '$lib/server/services/storageService';
import type { PageServerLoad } from './$types';

// « Stockage » of the active organization (step 4): quota, usage and its breakdown. The (org) group
// guarantees an active organization: `locals.orgContext` is set (hooks.server.ts).
export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { storage: await storageService.overview(locals.orgContext!) };
	} catch (err) {
		loadFailure(err);
	}
};
