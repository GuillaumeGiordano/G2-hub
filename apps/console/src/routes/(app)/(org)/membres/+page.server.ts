import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { checkbox, parseForm, requiredString } from '$lib/validation';
import { memberAddSchema, memberUpdateSchema } from '$lib/schemas/member';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as memberService from '$lib/server/services/memberService';
import type { Actions, PageServerLoad } from './$types';

// Admins only (and the superadmin): the service answers 403 to anyone else. The (org) group
// guarantees an active organization: `locals.orgContext` is set (hooks.server.ts). Editing an
// account shared with another organization is the superadmin's (DECISIONS.md §30).
const memberSchema = z.object({ membershipId: requiredString() });
const disableSchema = z.object({ membershipId: requiredString(), disabled: checkbox() });

export const load: PageServerLoad = async ({ locals, url }) => {
	const search = url.searchParams.get('q')?.trim() || undefined;
	try {
		return { members: await memberService.listMembers(locals.orgContext!, search), searching: !!search };
	} catch (err) {
		loadFailure(err);
	}
};

/** Run a one-member action, answering `{ [key]: <its e-mail> }`. */
async function memberAction(
	request: Request,
	key: string,
	run: (membershipId: string) => Promise<string>
) {
	const parsed = parseForm(await request.formData(), memberSchema);
	if (!parsed.success) return fail(400, { message: 'Membre introuvable.' });
	try {
		return { [key]: await run(parsed.data.membershipId) };
	} catch (err) {
		return actionFailure(err);
	}
}

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

	update: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), memberUpdateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { membershipId, ...input } = parsed.data;
			return { updated: await memberService.updateMember(locals.orgContext!, membershipId, input) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	reset: ({ request, locals }) =>
		memberAction(request, 'reset', (id) => memberService.sendMemberPasswordReset(locals.orgContext!, id)),

	revoke: ({ request, locals }) =>
		memberAction(request, 'revoked', (id) => memberService.revokeMemberSessions(locals.orgContext!, id)),

	twoFactor: ({ request, locals }) =>
		memberAction(request, 'twoFactorReset', (id) => memberService.resetMemberTwoFactor(locals.orgContext!, id)),

	disable: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), disableSchema);
		if (!parsed.success) return fail(400, { message: 'Membre introuvable.' });
		try {
			const { membershipId, disabled } = parsed.data;
			await memberService.setMemberDisabled(locals.orgContext!, membershipId, disabled);
			return { disabled };
		} catch (err) {
			return actionFailure(err);
		}
	},

	remove: ({ request, locals }) =>
		memberAction(request, 'removed', (id) => memberService.removeMember(locals.orgContext!, id))
};
