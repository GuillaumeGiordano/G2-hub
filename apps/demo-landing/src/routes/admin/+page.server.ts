import { fail } from '@sveltejs/kit';
import { HubError, type HubFile } from '@g2/hub-client';
import { findCreation, listCreations, removeCreation } from '$lib/server/db';
import { hubAdmin } from '$lib/server/hub';
import type { Actions, PageServerLoad } from './$types';

/** A creation of the site's database joined with its photo in G2 Hub (null if unreachable). */
export type CreationRow = {
	id: string;
	title: string;
	priceCents: number | null;
	createdAt: string;
	photo: Pick<HubFile, 'id' | 'status' | 'thumbnailUrl' | 'alt' | 'caption'> | null;
};

export const load: PageServerLoad = async () => {
	const hub = hubAdmin();
	const creations = await listCreations();
	const rows: CreationRow[] = await Promise.all(
		creations.map(async (c) => {
			let photo: CreationRow['photo'] = null;
			try {
				const f = hub ? await hub.file(c.hubFileId) : null;
				photo = f ? { id: f.id, status: f.status, thumbnailUrl: f.thumbnailUrl, alt: f.alt, caption: f.caption } : null;
			} catch {
				photo = null;
			}
			return { id: c.id, title: c.title, priceCents: c.priceCents, createdAt: c.createdAt, photo };
		})
	);
	return { rows, configured: !!hub };
};

export const actions: Actions = {
	/** Delete a creation: its photo in G2 Hub (only the site may — §22), then the site's row. */
	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const creation = await findCreation(id);
		const hub = hubAdmin();
		if (!creation || !hub) return fail(404, { message: 'Création introuvable.' });
		try {
			await hub.deleteFile(creation.hubFileId);
		} catch (err) {
			// Already gone from the hub: the site's row is removed anyway.
			if (!(err instanceof HubError && err.status === 404)) {
				return fail(502, { message: err instanceof HubError ? err.message : 'Suppression impossible.' });
			}
		}
		await removeCreation(id);
		return { deleted: true };
	}
};
