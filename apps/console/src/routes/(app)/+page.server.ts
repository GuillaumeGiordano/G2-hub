import * as storageService from '$lib/server/services/storageService';
import type { PageServerLoad } from './$types';

// Dashboard: the active organization's summary and its storage (moved here from the former
// « Stockage » page, DECISIONS.md §33). More indicators will join later.
export const load: PageServerLoad = async ({ locals }) => {
	const ctx = locals.orgContext;
	return { storage: ctx?.organization.storageEnabled ? await storageService.overview(ctx) : null };
};
