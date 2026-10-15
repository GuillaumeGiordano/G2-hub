import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { organizationContractSchema, organizationProfileSchema } from '$lib/schemas/organizationProfile';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as organizationService from '$lib/server/services/organizationService';
import type { Actions, PageServerLoad } from './$types';

// « Mon organisation » — the active organization's page, for its members (DECISIONS.md §31). The
// (org) group guarantees an active organization: `locals.orgContext` is set (hooks.server.ts).
// The profile is edited by its Admins, the contract by the superadmin (the service checks both).
export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { org: await organizationService.getMyOrganization(locals.orgContext!) };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), organizationProfileSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { saved: await organizationService.updateOrganizationProfile(locals.orgContext!, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	contract: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), organizationContractSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { saved: await organizationService.updateOrganizationContract(locals.orgContext!, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	logo: async ({ request, locals }) => {
		const file = (await request.formData()).get('logo');
		if (!(file instanceof File) || file.size === 0) return fail(400, { errors: { logo: 'Choisissez une image.' } });
		try {
			return { logo: await organizationService.setOrganizationLogo(locals.orgContext!, file) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	removeLogo: async ({ locals }) => {
		try {
			await organizationService.removeOrganizationLogo(locals.orgContext!);
			return { logoRemoved: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
