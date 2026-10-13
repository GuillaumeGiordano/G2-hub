import { error, json } from '@sveltejs/kit';
import { HubError } from '@g2/hub-client';
import { galleryPath, hubAdmin } from '$lib/server/hub';
import type { RequestHandler } from './$types';

// Step 1 of « Ajouter une photo »: the site's SERVER asks G2 Hub for an upload ticket with its secret
// key, and hands only the signed URL to the browser — which then PUTs the photo straight to storage.
export const POST: RequestHandler = async ({ request }) => {
	const hub = hubAdmin();
	if (!hub) error(503, 'DEMO_HUB_SECRET_KEY non configurée.');
	const body = (await request.json().catch(() => null)) as {
		name?: string;
		size?: number;
		contentType?: string;
		alt?: string;
		caption?: string;
	} | null;
	if (!body?.name || !body.size || !body.contentType) error(400, 'Fichier manquant.');
	try {
		const ticket = await hub.createUpload({
			path: galleryPath(),
			name: body.name,
			size: body.size,
			contentType: body.contentType,
			alt: body.alt || null,
			caption: body.caption || null
		});
		return json({ fileId: ticket.fileId, uploadUrl: ticket.uploadUrl, contentType: ticket.contentType });
	} catch (err) {
		if (err instanceof HubError) return json({ message: err.message }, { status: err.status || 502 });
		throw err;
	}
};
