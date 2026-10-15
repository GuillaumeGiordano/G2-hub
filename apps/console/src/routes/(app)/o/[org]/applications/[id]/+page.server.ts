import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { FOLDER_LOCKS } from '$lib/records/storage';
import { folderCreateSchema, folderRenameSchema } from '$lib/schemas/folder';
import { fileTextSchema } from '$lib/schemas/fileText';
import { actionFailure, loadFailure } from '$lib/server/http';
import { can } from '$lib/records/organization';
import * as folderService from '$lib/server/services/folderService';
import * as fileService from '$lib/server/services/fileService';
import * as mediaService from '$lib/server/services/mediaService';
import type { Actions, PageServerLoad } from './$types';

// File browser of one application. The current folder and the file open in the viewer live in the
// URL (`?dossier=&media=`): shareable, back-button friendly. Every id is re-checked against the
// session's organization by the services.
const idSchema = z.object({ id: requiredString() });
const folderLockSchema = z.object({ id: requiredString(), lock: z.enum(FOLDER_LOCKS) });

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const ctx = locals.orgContext!;
	try {
		const browser = await folderService.browse(ctx, params.id, url.searchParams.get('dossier'));
		const mediaId = url.searchParams.get('media');
		const [files, usage, media] = await Promise.all([
			browser.folder ? fileService.listFiles(ctx, browser.folder.id) : Promise.resolve([]),
			fileService.usage(ctx),
			mediaId ? mediaService.getMedia(ctx, params.id, mediaId) : Promise.resolve(null)
		]);
		const canManageKeys = can(ctx.organization.role, ctx.isSuperadmin, 'applications.manage');
		return { browser, files, usage, media, canManageKeys };
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

	/** Superadmin: what an Admin may do with this folder (§37). */
	lockFolder: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), folderLockSchema);
		if (!parsed.success) return fail(400, { message: 'Dossier introuvable.' });
		try {
			const { id, lock } = parsed.data;
			return { locked: await folderService.setFolderLock(locals.orgContext!, params.id, id, lock), lock };
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
	},

	updateText: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), fileTextSchema);
		if (!parsed.success) return fail(400, { errors: parsed.errors });
		try {
			const { id, alt, caption } = parsed.data;
			await fileService.updateFileText(locals.orgContext!, params.id, id, { alt: alt ?? null, caption: caption ?? null });
			return { saved: true };
		} catch (err) {
			return actionFailure(err);
		}
	},

	deleteFile: async ({ request, locals, params }) => {
		const parsed = parseForm(await request.formData(), idSchema);
		if (!parsed.success) return fail(400, { message: 'Fichier introuvable.' });
		try {
			await fileService.deleteFile(locals.orgContext!, params.id, parsed.data.id);
			return { deleted: true };
		} catch (err) {
			return actionFailure(err);
		}
	}
};
