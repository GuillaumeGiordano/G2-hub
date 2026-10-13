import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { applicationSchema, applicationUpdateSchema } from '$lib/schemas/application';
import { can } from '$lib/records/organization';
import { actionFailure } from '$lib/server/http';
import * as applicationService from '$lib/server/services/applicationService';
import type { Actions, PageServerLoad } from './$types';

// The (org) group guarantees an active organization: `locals.orgContext` is set (hooks.server.ts).
const idSchema = z.object({ id: requiredString() });

export const load: PageServerLoad = async ({ locals }) => {
	const ctx = locals.orgContext!;
	return {
		applications: await applicationService.listApplications(ctx),
		canManage: can(ctx.organization.role, ctx.isSuperadmin, 'applications.manage')
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), applicationSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { saved: await applicationService.createApplication(locals.orgContext!, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	update: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), applicationUpdateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { id, ...input } = parsed.data;
			return { saved: await applicationService.updateApplication(locals.orgContext!, id, input) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	delete: async ({ request, locals }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Application introuvable.' });
		try {
			await applicationService.deleteApplication(locals.orgContext!, parsed.data.id);
			return { deleted: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
