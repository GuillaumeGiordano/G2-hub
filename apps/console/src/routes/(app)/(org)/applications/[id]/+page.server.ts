import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { folderCreateSchema, folderRenameSchema } from '$lib/schemas/folder';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as folderService from '$lib/server/services/folderService';
import type { Actions, PageServerLoad } from './$types';

// File browser of one application. The current folder lives in the URL (`?dossier=`): shareable,
// back-button friendly. Every id is re-checked against the session's organization by the service.
const idSchema = z.object({ id: requiredString() });

export const load: PageServerLoad = async ({ locals, params, url }) => {
	try {
		return {
			browser: await folderService.browse(locals.orgContext!, params.id, url.searchParams.get('dossier'))
		};
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
	createFolder: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), folderCreateSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			return { saved: await folderService.createFolder(locals.orgContext!, params.id, parsed.data) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	renameFolder: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), folderRenameSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { id, name } = parsed.data;
			return { saved: await folderService.renameFolder(locals.orgContext!, params.id, id, name) };
		} catch (err) {
			return actionFailure(err);
		}
	},

	deleteFolder: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Dossier introuvable.' });
		try {
			await folderService.deleteFolder(locals.orgContext!, params.id, parsed.data.id);
			return { deleted: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
