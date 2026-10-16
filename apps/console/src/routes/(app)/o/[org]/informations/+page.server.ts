import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { organizationProfileSchema, organizationStatusSchema } from '$lib/schemas/organizationProfile';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as organizationService from '$lib/server/services/organizationService';
import type { Actions, PageServerLoad } from './$types';

// « Mon organisation › Informations » (/o/<id>/informations) — the organization, for its members
// (DECISIONS.md §31). The hook guarantees `locals.orgContext` (the organization of the address,
// access checked). Its Admins edit the name and the logo, the superadmin the status (the service
// checks both); the legal and billing profile lives in g2-erp.
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

	status: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), organizationStatusSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { saved: await organizationService.updateOrganizationStatus(locals.orgContext!, parsed.data) };
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
