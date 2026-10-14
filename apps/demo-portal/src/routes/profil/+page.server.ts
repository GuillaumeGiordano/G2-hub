import { fail, redirect } from '@sveltejs/kit';
import { HubError, type HubFile, type HubUserSpace } from '@g2/hub-client';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, DOCUMENT_MAX_BYTES, hub } from '$lib/server/hub';
import type { Actions, PageServerLoad } from './$types';

// « Mon profil »: the member's personal space in G2 Hub (DECISIONS.md §28) — an avatar in the
// PUBLIC space (a stable URL any page can show), documents in the PRIVATE one (10-minute signed
// links). Every call carries the secret key AND the member's access token: the hub itself refuses
// another member's files, whatever this portal sends.

/** A member's personal space, or why there is none. Admins (sub `m_…`) have none: their account
 *  is a console account. */
function space(locals: App.Locals): { me: HubUserSpace } | { reason: 'config' | 'admin' | 'expired' } {
	const client = hub();
	if (!client) return { reason: 'config' };
	if (!locals.user || locals.user.role === 'admin') return { reason: 'admin' };
	if (!locals.hubToken || locals.hubToken.expiresAt <= new Date()) return { reason: 'expired' };
	return { me: client.asUser(locals.hubToken.accessToken) };
}

/** A 401 from the hub = the access token is no longer valid: sign in again. */
const failure = (err: unknown, fallback: string) => {
	if (err instanceof HubError && err.status === 401) return fail(401, { message: 'Session G2 Hub expirée : reconnectez-vous.' });
	return fail(err instanceof HubError && err.status ? err.status : 502, { message: err instanceof HubError ? err.message : fallback });
};

export type ProfileFile = { id: string; name: string; url: string; thumbnailUrl: string | null; bytes: number; createdAt: string };

const toProfileFile = (f: HubFile): ProfileFile => ({
	id: f.id,
	name: f.name,
	url: f.url,
	thumbnailUrl: f.versions.thumb?.url ?? null,
	bytes: f.bytes,
	createdAt: f.createdAt
});

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/');
	const s = space(locals);
	if (!('me' in s)) return { user: locals.user, unavailable: s.reason, avatar: null, documents: [] };
	try {
		const [pub, priv] = await Promise.all([s.me.files('public'), s.me.files('private')]);
		// The newest image of the public space is the avatar.
		const avatar = pub.files.find((f) => f.kind === 'IMAGE');
		return {
			user: locals.user,
			unavailable: null,
			avatar: avatar ? toProfileFile(avatar) : null,
			documents: priv.files.map(toProfileFile)
		};
	} catch (err) {
		if (err instanceof HubError && err.status === 401) {
			return { user: locals.user, unavailable: 'expired' as const, avatar: null, documents: [] };
		}
		throw err;
	}
};

/** The uploaded file of a form, or a message. */
function fileOf(form: FormData, types: string[] | null, maxBytes: number): File | string {
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) return 'Choisissez un fichier.';
	if (types && !types.includes(file.type)) return 'Format non accepté.';
	if (file.size > maxBytes) return `Fichier trop lourd (${Math.round(maxBytes / 1024 / 1024)} Mo maximum).`;
	return file;
}

export const actions: Actions = {
	/** Replace the avatar: the new image first, then the previous ones (no moment without avatar). */
	avatar: async ({ request, locals }) => {
		const s = space(locals);
		if (!('me' in s)) return fail(s.reason === 'expired' ? 401 : 403, { message: 'Espace personnel indisponible.' });
		const file = fileOf(await request.formData(), AVATAR_TYPES, AVATAR_MAX_BYTES);
		if (typeof file === 'string') return fail(400, { message: file });
		try {
			const before = await s.me.files('public');
			const uploaded = await s.me.uploadFile({ space: 'public', name: file.name, contentType: file.type, data: file });
			for (const old of before.files) if (old.id !== uploaded.id) await s.me.deleteFile(old.id);
			return { saved: 'Photo de profil mise à jour.' };
		} catch (err) {
			return failure(err, 'Envoi impossible.');
		}
	},

	/** Add a document to the PRIVATE space (PDF or image). */
	document: async ({ request, locals }) => {
		const s = space(locals);
		if (!('me' in s)) return fail(s.reason === 'expired' ? 401 : 403, { message: 'Espace personnel indisponible.' });
		const file = fileOf(await request.formData(), null, DOCUMENT_MAX_BYTES);
		if (typeof file === 'string') return fail(400, { message: file });
		try {
			await s.me.uploadFile({ space: 'private', name: file.name, contentType: file.type, data: file });
			return { saved: 'Document ajouté.' };
		} catch (err) {
			return failure(err, 'Envoi impossible.');
		}
	},

	/** Delete one of the member's files — the hub answers 404 for anyone else's id. */
	delete: async ({ request, locals }) => {
		const s = space(locals);
		if (!('me' in s)) return fail(s.reason === 'expired' ? 401 : 403, { message: 'Espace personnel indisponible.' });
		const id = String((await request.formData()).get('id') ?? '');
		try {
			await s.me.deleteFile(id);
			return { saved: 'Fichier supprimé.' };
		} catch (err) {
			return failure(err, 'Suppression impossible.');
		}
	}
};
