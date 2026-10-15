import { fail } from '@sveltejs/kit';
import { HubError, type HubFile } from '@g2/hub-client';
import { addCreation, findCreation, listCreations, removeCreation } from '$lib/server/db';
import { galleryPath, hubAdmin, pinRef } from '$lib/server/hub';
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
	// The « Dossier » select of the upload form: the gallery by default, any other folder sometimes.
	const folders = hub ? await hub.folderTree().then((t) => t.folders, () => []) : [];
	return { rows, configured: !!hub, folders, galleryPath: galleryPath() };
};

/** A hub call whose 404 (file already gone from the hub) is not an error for the site. */
async function ignoringNotFound(call: () => Promise<unknown>): Promise<void> {
	try {
		await call();
	} catch (err) {
		if (!(err instanceof HubError && err.status === 404)) throw err;
	}
}

const failure = (err: unknown, fallback: string) =>
	fail(err instanceof HubError && err.status ? err.status : 502, { message: err instanceof HubError ? err.message : fallback });

export const actions: Actions = {
	/** A creation whose photo is CHOSEN in the hub's media library (§23): saved with its file id,
	 *  then the photo is pinned so that nobody deletes it in the hub while the creation uses it. */
	pick: async ({ request }) => {
		const form = await request.formData();
		const fileId = String(form.get('fileId') ?? '');
		const title = String(form.get('title') ?? '').trim();
		const price = Number(String(form.get('price') ?? '').replace(',', '.'));
		const hub = hubAdmin();
		if (!hub) return fail(503, { message: 'DEMO_HUB_SECRET_KEY non configurée.' });
		if (!fileId || !title) return fail(400, { message: 'Choisissez une photo et donnez-lui un titre.' });
		try {
			const file = await hub.file(fileId);
			if (file.kind !== 'IMAGE' || file.status !== 'READY') return fail(400, { message: 'Choisissez une image prête.' });
			const creation = await addCreation({
				hubFileId: file.id,
				ownsPhoto: false,
				title,
				priceCents: String(form.get('price') ?? '').trim() && Number.isFinite(price) ? Math.round(price * 100) : null
			});
			try {
				await hub.pinFile(file.id, pinRef(creation.id));
			} catch (err) {
				await removeCreation(creation.id); // unprotected photo = no creation
				throw err;
			}
			return { picked: title };
		} catch (err) {
			return failure(err, 'Ajout impossible.');
		}
	},

	/** Delete a creation: free its photo in G2 Hub, delete the photo too if it was uploaded for this
	 *  creation (a library photo stays in the library), then the site's row. */
	delete: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const creation = await findCreation(id);
		const hub = hubAdmin();
		if (!creation || !hub) return fail(404, { message: 'Création introuvable.' });
		try {
			await ignoringNotFound(() => hub.unpinFile(creation.hubFileId, pinRef(creation.id)));
			if (creation.ownsPhoto !== false) await ignoringNotFound(() => hub.deleteFile(creation.hubFileId));
		} catch (err) {
			return failure(err, 'Suppression impossible.');
		}
		await removeCreation(id);
		return { deleted: true };
	}
};
