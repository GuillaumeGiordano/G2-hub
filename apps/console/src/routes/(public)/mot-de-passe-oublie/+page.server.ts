import { error, fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { passwordForgotSchema } from '$lib/schemas/appUser';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as appUserService from '$lib/server/services/appUserService';
import type { Actions, PageServerLoad } from './$types';

// « Mot de passe oublié » of an APPLICATION user (portal end user, DECISIONS.md §24). The portal (or
// the hub's sign-in page, step 5b) links here with `?app=<application id>`.

export const load: PageServerLoad = async ({ url }) => {
	const appId = url.searchParams.get('app');
	if (!appId) error(404, 'Application introuvable.');
	try {
		return { application: await appUserService.publicApplication(appId) };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const parsed = parseForm(await request.formData(), passwordForgotSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		const appId = url.searchParams.get('app');
		if (!appId) return fail(404, { message: 'Application introuvable.' });
		// Same answer whether the address has an account or not (the service sends only if it does).
		try {
			await appUserService.requestPasswordReset(appId, parsed.data.email);
			return { sent: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
