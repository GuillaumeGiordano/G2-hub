import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The console's « Médiathèque » tab was merged into « Fichiers » (DECISIONS.md §29): an old link
// (`?media=<id>` included) lands on the Files tab, which opens the same viewer.
export const GET: RequestHandler = ({ params, url }) => {
	const media = url.searchParams.get('media');
	redirect(308, `/applications/${params.id}${media ? `?media=${encodeURIComponent(media)}` : ''}`);
};
