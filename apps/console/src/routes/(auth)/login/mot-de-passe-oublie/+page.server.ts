import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { consolePasswordForgotSchema } from '$lib/schemas/account';
import { actionFailure } from '$lib/server/http';
import * as accountService from '$lib/server/services/accountService';
import { clientOf } from '$lib/server/services/signInLogService';
import { allowHit, RESET_PER_IP } from '$lib/server/rateLimit';
import type { Actions } from './$types';

// « Mot de passe oublié » of a CONSOLE account (DECISIONS.md §30). Same answer whether the address
// has an account or not. Called server-side, so Better Auth's own rate limit does not apply: the
// per-IP limit is checked here (§41), silently like the rest.
export const actions: Actions = {
	default: async (event) => {
		const parsed = parseForm(await event.request.formData(), consolePasswordForgotSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		const ip = clientOf(event).ipAddress;
		if (!allowHit(ip && `console-reset:${ip}`, RESET_PER_IP.max, RESET_PER_IP.windowMs)) return { sent: true };
		try {
			await accountService.requestPasswordReset(parsed.data.email);
			return { sent: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
