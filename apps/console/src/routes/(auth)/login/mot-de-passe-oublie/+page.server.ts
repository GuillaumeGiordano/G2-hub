import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { consolePasswordForgotSchema } from '$lib/schemas/account';
import { actionFailure } from '$lib/server/http';
import * as accountService from '$lib/server/services/accountService';
import type { Actions } from './$types';

// « Mot de passe oublié » of a CONSOLE account (DECISIONS.md §30). Same answer whether the address
// has an account or not.
export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = parseForm(await request.formData(), consolePasswordForgotSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			await accountService.requestPasswordReset(parsed.data.email);
			return { sent: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
