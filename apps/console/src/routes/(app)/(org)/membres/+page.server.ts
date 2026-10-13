import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { memberAddSchema, memberRoleSchema } from '$lib/schemas/member';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as memberService from '$lib/server/services/memberService';
import type { Actions, PageServerLoad } from './$types';

// Owners only (and the superadmin): the service answers 403 to the other roles. The (org) group
// guarantees an active organization: `locals.orgContext` is set (hooks.server.ts).
const removeSchema = z.object({ membershipId: requiredString() });

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { members: await memberService.listMembers(locals.orgContext!) };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), memberAddSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { added: await memberService.addMember(locals.orgContext!, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	role: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), memberRoleSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { membershipId, role } = parsed.data;
			return { updated: await memberService.changeRole(locals.orgContext!, membershipId, role) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	remove: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), removeSchema);
		if (!parsed.success) return fail(400, { message: 'Membre introuvable.' });
		try {
			return { removed: await memberService.removeMember(locals.orgContext!, parsed.data.membershipId) };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
