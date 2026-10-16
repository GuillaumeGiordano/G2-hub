import { fail } from '@sveltejs/kit';
import { parseForm } from '$lib/validation';
import { toolToggleSchema } from '$lib/schemas/platform';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as platformService from '$lib/server/services/platformService';
import type { Actions, PageServerLoad } from './$types';

// « Outils » of an organization (DECISIONS.md §38): the launcher of the client portal and of the
// tools enabled for THIS organization; the superadmin also enables / disables the tools here.
// The hook guarantees the organization of the address is one the account may open.

export const load: PageServerLoad = async ({ locals }) => {
	const ctx = locals.orgContext!;
	try {
		return {
			launcher: await platformService.launcher(ctx),
			tools: ctx.isSuperadmin ? await platformService.listOrganizationTools(ctx) : null
		};
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), toolToggleSchema);
		if (!parsed.success) return fail(400, { message: 'Outil introuvable.' });
		try {
			const { applicationId, enabled } = parsed.data;
			return { tool: await platformService.setToolEnabled(locals.orgContext!, applicationId, enabled), enabled };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
