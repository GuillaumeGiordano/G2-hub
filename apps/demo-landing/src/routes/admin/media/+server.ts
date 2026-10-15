import { error, json } from '@sveltejs/kit';
import { HubError } from '@g2/hub-client';
import { hubAdmin } from '$lib/server/hub';
import type { RequestHandler } from './$types';

// « Choisir dans la médiathèque »: the site's SERVER lists the application's images from G2 Hub with
// its secret key and hands the browser only what the picker shows (DECISIONS.md §23).
export const GET: RequestHandler = async ({ url }) => {
	const hub = hubAdmin();
	if (!hub) error(503, 'DEMO_HUB_SECRET_KEY non configurée.');
	try {
		const listing = await hub.media({
			kind: 'IMAGE',
			q: url.searchParams.get('q') || undefined,
			folder: url.searchParams.get('folder') || undefined,
			page: Number(url.searchParams.get('page')) || 1,
			perPage: 12
		});
		return json({
			files: listing.files.map((f) => ({ id: f.id, name: f.name, alt: f.alt, thumbnailUrl: f.thumbnailUrl })),
			total: listing.total,
			page: listing.page,
			perPage: listing.perPage
		});
	} catch (err) {
		if (err instanceof HubError) return json({ message: err.message }, { status: err.status || 502 });
		throw err;
	}
};
