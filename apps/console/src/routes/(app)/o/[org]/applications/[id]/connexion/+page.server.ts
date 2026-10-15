import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { ssoRedirectsSchema } from '$lib/schemas/sso';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as ssoService from '$lib/server/services/ssoService';
import type { Actions, PageServerLoad } from './$types';

// « Se connecter avec G2 Hub » settings of one application — owners only (the service answers 403
// to the other roles). DECISIONS.md §25.

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		return { sso: await ssoService.getSso(locals.orgContext!, params.id) };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	secret: async ({ locals, params }) => {
		try {
			return { secret: await ssoService.createSecret(locals.orgContext!, params.id) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	redirects: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), ssoRedirectsSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			await ssoService.updateRedirectUris(locals.orgContext!, params.id, parsed.data.redirectUris);
			return { saved: true };
		} catch (err) {
			return actionFailure(err);
		}
	},

	disable: async ({ locals, params }) => {
		try {
			await ssoService.disableSso(locals.orgContext!, params.id);
			return { disabled: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
