import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { passwordChooseSchema } from '$lib/schemas/appUser';
import { actionFailure } from '$lib/server/http';
import * as appUserService from '$lib/server/services/appUserService';
import { clientOf } from '$lib/server/services/signInLogService';
import type { Actions, PageServerLoad } from './$types';

// « Choisir un mot de passe » — opened from an invitation or reset e-mail by an APPLICATION user
// (portal end user, DECISIONS.md §24). Public: the single-use token in the URL is the credential.

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// The token is in the URL: never send it to another site in a Referer header.
	setHeaders({ 'referrer-policy': 'same-origin', 'cache-control': 'no-store' });
	return { link: await appUserService.passwordLink(params.token) };
};

export const actions: Actions = {
	default: async (event) => {
		const { request, params } = event;
		const parsed = parseForm(await request.formData(), passwordChooseSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { done: await appUserService.choosePassword(params.token, parsed.data.password, clientOf(event)) };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
