import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { checkbox, parseForm, requiredString } from '$lib/validation';
import { appUserInviteSchema } from '$lib/schemas/appUser';
import { can } from '$lib/records/organization';
import { DEFAULT_PER_PAGE } from '$lib/constants';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as appUserService from '$lib/server/services/appUserService';
import * as folderService from '$lib/server/services/folderService';
import type { Actions, PageServerLoad } from './$types';

// Users of one application's portal (DECISIONS.md §24): managed by the organization's Admins
// (the service answers 403 to anyone else).
const idSchema = z.object({ id: requiredString() });
const disableSchema = z.object({ id: requiredString(), disabled: checkbox() });

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const ctx = locals.orgContext!;
	const search = url.searchParams.get('q')?.trim() || undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const perPage = Number(url.searchParams.get('perPage')) || DEFAULT_PER_PAGE;
	try {
		const [application, { items, total }] = await Promise.all([
			folderService.applicationOrThrow(ctx, params.id),
			appUserService.listAppUsers(ctx, params.id, { search, page, perPage })
		]);
		return {
			application,
			items,
			total,
			page,
			perPage,
			canManage: can(ctx.organization.role, ctx.isSuperadmin, 'appUsers.manage'),
			canManageKeys: can(ctx.organization.role, ctx.isSuperadmin, 'applications.manage')
		};
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	invite: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), appUserInviteSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { invited: await appUserService.inviteAppUser(locals.orgContext!, params.id, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	resend: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Utilisateur introuvable.' });
		try {
			return { resent: await appUserService.resendInvitation(locals.orgContext!, params.id, parsed.data.id) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	disable: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), disableSchema);
		if (!parsed.success) return fail(400, { message: 'Utilisateur introuvable.' });
		try {
			const { id, disabled } = parsed.data;
			await appUserService.setAppUserDisabled(locals.orgContext!, params.id, id, disabled);
			return { disabled };
		} catch (err) {
			return actionFailure(err);
		}
	},

	delete: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Utilisateur introuvable.' });
		try {
			return { deleted: await appUserService.deleteAppUser(locals.orgContext!, params.id, parsed.data.id) };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
