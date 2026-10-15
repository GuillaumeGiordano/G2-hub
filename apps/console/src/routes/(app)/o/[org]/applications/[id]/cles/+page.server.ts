import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { apiKeyCreateSchema } from '$lib/schemas/apiKey';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as apiKeyService from '$lib/server/services/apiKeyService';
import * as folderService from '$lib/server/services/folderService';
import type { Actions, PageServerLoad } from './$types';

// API keys of one application — owners only (the service answers 403 to the other roles).
const idSchema = z.object({ id: requiredString() });

export const load: PageServerLoad = async ({ locals, params }) => {
	const ctx = locals.orgContext!;
	try {
		const [application, keys] = await Promise.all([
			folderService.applicationOrThrow(ctx, params.id),
			apiKeyService.listKeys(ctx, params.id)
		]);
		return { application, keys };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), apiKeyCreateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { created: await apiKeyService.createKey(locals.orgContext!, params.id, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	revoke: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Clé introuvable.' });
		try {
			await apiKeyService.revokeKey(locals.orgContext!, params.id, parsed.data.id);
			return { revoked: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
