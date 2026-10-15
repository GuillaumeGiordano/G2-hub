import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { isSuperadmin } from '$lib/records/roles';
import { actionFailure } from '$lib/server/http';
import * as organizationService from '$lib/server/services/organizationService';
import type { Actions, PageServerLoad } from './$types';

// « Choisir une organisation » — for a member of several organizations (DECISIONS.md §31). It lists
// only the member's own organizations, by name; the full list is the superadmin's (/organisations).
const idSchema = z.object({ id: requiredString() });

const actorOf = (locals: App.Locals) => ({ id: locals.user!.id, isSuperadmin: isSuperadmin(locals.user!.role) });

export const load: PageServerLoad = async ({ locals }) => {
	if (isSuperadmin(locals.user!.role)) redirect(303, '/organisations');
	return {
		organizations: await organizationService.myOrganizations(actorOf(locals)),
		activeId: locals.organization?.id ?? null
	};
};

export const actions: Actions = {
	/** Work in this organization: stored on the session after checking the membership. */
	open: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Organisation introuvable.' });
		try {
			await organizationService.switchOrganization(locals.session!.id, actorOf(locals), parsed.data.id);
		} catch (err) {
			return actionFailure(err);
		}
		redirect(303, '/mon-organisation');
	}
};
