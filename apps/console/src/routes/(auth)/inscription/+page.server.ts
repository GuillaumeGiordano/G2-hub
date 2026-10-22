import { error, fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { signupSchema } from '$lib/schemas/signup';
import { actionFailure } from '$lib/server/http';
import { privacyUrl } from '$lib/server/instance';
import { clientOf } from '$lib/server/services/signInLogService';
import * as signupService from '$lib/server/services/signupService';
import type { Actions, PageServerLoad } from './$types';

// « Créer un compte » (DECISIONS.md §45): reached from the portal's sign-in page, `?returnTo=` being
// that authorize request. Without public sign-up, or with any other return address: 404.
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'same-origin' });
	const target = await signupService.signupTarget(url.searchParams.get('returnTo'));
	if (!target) error(404, 'Page introuvable.');
	return {
		applicationName: target.applicationName,
		privacyUrl: privacyUrl()!,
		loginHref: `/login?${new URLSearchParams({ redirectTo: target.returnTo })}`
	};
};

export const actions: Actions = {
	default: async (event) => {
		const parsed = parseForm(await event.request.formData(), signupSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		const target = await signupService.signupTarget(event.url.searchParams.get('returnTo'));
		if (!target) return fail(400, { message: "L'inscription n'est pas disponible." });
		try {
			await signupService.requestSignup(parsed.data, target.returnTo, clientOf(event));
			return { sent: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
