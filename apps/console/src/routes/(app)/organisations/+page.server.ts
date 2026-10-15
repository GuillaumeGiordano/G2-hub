import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { organizationCreateSchema, organizationUpdateSchema } from '$lib/schemas/organization';
import { isSuperadmin } from '$lib/records/roles';
import { DEFAULT_PER_PAGE } from '$lib/constants';
import { actionFailure } from '$lib/server/http';
import * as organizationService from '$lib/server/services/organizationService';
import type { Actions, PageServerLoad } from './$types';

const idSchema = z.object({ id: requiredString() });

/** The acting account (the hook guarantees a signed-in user on this route). */
function actorOf(locals: App.Locals) {
	return { id: locals.user!.id, isSuperadmin: isSuperadmin(locals.user!.role) };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// The list of organizations is the superadmin's (§31): a member goes to their own.
	if (!isSuperadmin(locals.user!.role)) redirect(303, locals.organization ? '/mon-organisation' : '/choisir-organisation');
	const search = url.searchParams.get('q')?.trim() || undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const perPage = Number(url.searchParams.get('perPage')) || DEFAULT_PER_PAGE;
	const { items, total } = await organizationService.listOrganizations(actorOf(locals), {
		search,
		page,
		perPage
	});
	return { items, total, page, perPage };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), organizationCreateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const created = await organizationService.createOrganization(actorOf(locals), parsed.data);
			return { created };
		} catch (err) {
			return actionFailure(err);
		}
	},

	update: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), organizationUpdateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { id, ...input } = parsed.data;
			return { updated: await organizationService.updateOrganization(actorOf(locals), id, input) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	delete: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Organisation introuvable.' });
		try {
			return { deleted: await organizationService.deleteOrganization(actorOf(locals), parsed.data.id) };
		} catch (err) {
			return actionFailure(err);
		}
	},

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
