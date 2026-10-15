import { error, fail, redirect } from '@sveltejs/kit';
import { HubError, type HubFolder } from '@g2/hub-client';
import { GALLERY_MAX_BYTES, GALLERY_TYPES, galleryPath, hub } from '$lib/server/hub';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// « Gérer la galerie » — the site's back-office inside the portal, for the ADMINS of the client's
// organization (role claim from G2 Hub, DECISIONS.md §30). The role is checked HERE, on the server,
// for the page and for every action: hiding the button is not a protection. The hub only sees the
// application's secret key: these are the SITE's files, not a personal space.

/** The signed-in admin, or a redirect / 403. */
function requireAdmin(locals: App.Locals) {
	if (!locals.user) redirect(303, '/');
	if (locals.user.role !== 'admin') error(403, "Réservé aux admins de l'organisation.");
	return locals.user;
}

const failure = (err: unknown, fallback: string) =>
	fail(err instanceof HubError && err.status ? err.status : 502, { message: err instanceof HubError ? err.message : fallback });

export type GalleryItem = {
	id: string;
	name: string;
	kind: 'IMAGE' | 'VIDEO' | 'PDF';
	thumbnailUrl: string | null;
	url: string;
	alt: string | null;
	caption: string | null;
	/** Pinned by the site (a creation uses it): the hub refuses its deletion. */
	pinned: boolean;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireAdmin(locals);
	const client = hub();
	if (!client) return { user, configured: false, folders: [] as HubFolder[], current: galleryPath(), gallery: galleryPath(), items: [] as GalleryItem[], error: null };
	// The managed folder is in the URL (`?dossier=Galerie/Été`): the gallery by default.
	const current = url.searchParams.get('dossier') || galleryPath();
	try {
		const [{ folders }, listing] = await Promise.all([client.folderTree(), client.files(current)]);
		const items: GalleryItem[] = listing.files.map((f) => ({
			id: f.id,
			name: f.name,
			kind: f.kind,
			thumbnailUrl: f.thumbnailUrl,
			url: f.url,
			alt: f.alt,
			caption: f.caption,
			pinned: f.pins.length > 0
		}));
		return { user, configured: true, folders, current: listing.folder.path, gallery: galleryPath(), items, error: null };
	} catch (err) {
		const message = err instanceof HubError ? err.message : 'G2 Hub indisponible.';
		return { user, configured: true, folders: [] as HubFolder[], current, gallery: galleryPath(), items: [] as GalleryItem[], error: message };
	}
};

/** The text fields of a form: empty = none. */
const textOf = (form: FormData, name: string) => String(form.get(name) ?? '').trim() || null;

async function adminClient({ locals }: RequestEvent) {
	requireAdmin(locals);
	const client = hub();
	if (!client) error(503, 'DEMO_HUB_SECRET_KEY non configurée.');
	return client;
}

export const actions: Actions = {
	/** Send a photo to the chosen folder (the gallery unless the admin picked another one). */
	upload: async (event) => {
		const client = await adminClient(event);
		const form = await event.request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { message: 'Choisissez une photo.' });
		if (!GALLERY_TYPES.includes(file.type)) return fail(400, { message: 'Format non accepté (JPEG, PNG ou WebP).' });
		if (file.size > GALLERY_MAX_BYTES) return fail(400, { message: 'Photo trop lourde (10 Mo maximum).' });
		const path = String(form.get('folder') ?? '') || galleryPath();
		try {
			await client.uploadFile({
				path,
				name: file.name,
				contentType: file.type,
				data: file,
				alt: textOf(form, 'alt'),
				caption: textOf(form, 'caption')
			});
			return { saved: `Photo ajoutée dans « ${path} ».` };
		} catch (err) {
			return failure(err, 'Envoi impossible.');
		}
	},

	/** Alternative text and caption — what the landing shows under the photo. */
	update: async (event) => {
		const client = await adminClient(event);
		const form = await event.request.formData();
		try {
			await client.updateFile(String(form.get('id') ?? ''), { alt: textOf(form, 'alt'), caption: textOf(form, 'caption') });
			return { saved: 'Textes enregistrés.' };
		} catch (err) {
			return failure(err, 'Enregistrement impossible.');
		}
	},

	/** Delete a photo — the hub refuses (409) while a creation of the site uses it. */
	delete: async (event) => {
		const client = await adminClient(event);
		const form = await event.request.formData();
		try {
			await client.deleteFile(String(form.get('id') ?? ''));
			return { saved: 'Photo supprimée.' };
		} catch (err) {
			return failure(err, 'Suppression impossible.');
		}
	}
};
