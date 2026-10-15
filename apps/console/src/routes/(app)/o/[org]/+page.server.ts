import * as storageService from '$lib/server/services/storageService';
import type { PageServerLoad } from './$types';

// An organization's dashboard (/o/<id>): its summary and its storage (moved here from the former
// « Stockage » page, DECISIONS.md §33). More indicators will join later. The hook guarantees the
// organization of the address is one the account may open: `locals.orgContext` is set.
export const load: PageServerLoad = async ({ locals }) => {
	const ctx = locals.orgContext!;
	return { storage: ctx.organization.storageEnabled ? await storageService.overview(ctx) : null };
};
