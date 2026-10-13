import { error, json } from '@sveltejs/kit';
import { HubError } from '@g2/hub-client';
import { addCreation } from '$lib/server/db';
import { hubAdmin } from '$lib/server/hub';
import type { RequestHandler } from './$types';

// Step 3 of « Ajouter une photo »: the photo was PUT to storage — the site's server confirms it to
// G2 Hub, then stores its OWN data (title, price) with the hub file id in the site's database.
export const POST: RequestHandler = async ({ params, request }) => {
	const hub = hubAdmin();
	if (!hub) error(503, 'DEMO_HUB_SECRET_KEY non configurée.');
	const body = (await request.json().catch(() => null)) as { title?: string; price?: string } | null;
	const title = body?.title?.trim();
	if (!title) error(400, 'Titre requis.');
	const price = body?.price ? Number(body.price.replace(',', '.')) : NaN;
	try {
		const file = await hub.completeUpload(params.fileId);
		if (file.status === 'FAILED') return json({ message: file.error ?? 'Photo illisible.' }, { status: 422 });
		const creation = await addCreation({
			hubFileId: file.id,
			title,
			priceCents: Number.isFinite(price) ? Math.round(price * 100) : null
		});
		return json({ creation, file });
	} catch (err) {
		if (err instanceof HubError) return json({ message: err.message }, { status: err.status || 502 });
		throw err;
	}
};
