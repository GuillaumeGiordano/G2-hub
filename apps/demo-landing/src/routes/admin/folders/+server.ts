import { error, json } from '@sveltejs/kit';
import { HubError } from '@g2/hub-client';
import { hubAdmin } from '$lib/server/hub';
import type { RequestHandler } from './$types';

// The application's folders for the « Dossier » selects: the site's SERVER reads the tree from
// G2 Hub with its secret key and hands the browser only ids and paths (DECISIONS.md §30).
export const GET: RequestHandler = async () => {
	const hub = hubAdmin();
	if (!hub) error(503, 'DEMO_HUB_SECRET_KEY non configurée.');
	try {
		const { folders } = await hub.folderTree();
		return json({ folders: folders.map((f) => ({ id: f.id, path: f.path, visibility: f.visibility })) });
	} catch (err) {
		if (err instanceof HubError) return json({ message: err.message }, { status: err.status || 502 });
		throw err;
	}
};
