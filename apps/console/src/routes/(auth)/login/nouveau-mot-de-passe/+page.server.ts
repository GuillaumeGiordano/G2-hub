import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { consolePasswordResetSchema } from '$lib/schemas/account';
import { actionFailure } from '$lib/server/http';
import * as accountService from '$lib/server/services/accountService';
import type { Actions, PageServerLoad } from './$types';

// A console account chooses a new password from its e-mailed link (`?token=`, DECISIONS.md §30).
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	// The token is in the URL: never send it to another site, never cache the page.
	setHeaders({ 'referrer-policy': 'same-origin', 'cache-control': 'no-store' });
	const token = url.searchParams.get('token') ?? '';
	return { token, valid: await accountService.resetLinkIsValid(token) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseForm(await request.formData(), consolePasswordResetSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			await accountService.resetPassword(parsed.data.token, parsed.data.password);
			return { done: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
