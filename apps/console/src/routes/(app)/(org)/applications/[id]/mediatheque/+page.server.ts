import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { parseForm, requiredString } from '$lib/validation';
import { fileTextSchema } from '$lib/schemas/fileText';
import { FILE_KINDS, type FileKind } from '$lib/records/files';
import { MEDIA_PER_PAGE } from '$lib/constants';
import { can } from '$lib/records/organization';
import { actionFailure, loadFailure } from '$lib/server/http';
import * as fileService from '$lib/server/services/fileService';
import * as mediaService from '$lib/server/services/mediaService';
import type { Actions, PageServerLoad } from './$types';

// Media library of one application: every READY file, filters and viewer in the URL
// (`?type=&dossier=&q=&page=&media=`) — shareable, back-button friendly.
const idSchema = z.object({ id: requiredString() });

const isKind = (v: string | null): v is FileKind => !!v && (FILE_KINDS as readonly string[]).includes(v);

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const ctx = locals.orgContext!;
	const type = url.searchParams.get('type');
	try {
		const library = await mediaService.listMedia(ctx, params.id, {
			kind: isKind(type) ? type : undefined,
			folderId: url.searchParams.get('dossier') || undefined,
			search: url.searchParams.get('q')?.trim() || undefined,
			page: Math.max(1, Number(url.searchParams.get('page')) || 1),
			perPage: MEDIA_PER_PAGE
		});
		// A `?media=` link to an item outside the current page is loaded on its own.
		const mediaId = url.searchParams.get('media');
		const selected =
			mediaId && !library.items.some((m) => m.id === mediaId)
				? await mediaService.getMedia(ctx, params.id, mediaId)
				: null;
		const canManageKeys = can(ctx.organization.role, ctx.isSuperadmin, 'applications.manage');
		return { library, selected, canManageKeys };
	} catch (err) {
		loadFailure(err);
	}
};

export const actions: Actions = {
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
