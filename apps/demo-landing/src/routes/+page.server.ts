import { HubError } from '@g2/hub-client';
import { galleryPath, hub } from '$lib/server/hub';
import type { PageServerLoad } from './$types';

/** A gallery image as the page shows it. */
export type GalleryImage = { src: string; alt: string };

/** "croissant-beurre.jpg" → "croissant beurre". */
const altOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');

// Server-side read (no CORS involved, the key never reaches the visitor's browser even though a
// publishable one could). Photos are added / removed in the hub's console: no deploy of this site.
export const load: PageServerLoad = async () => {
	const client = hub();
	if (!client) return { images: [] as GalleryImage[], error: 'DEMO_HUB_KEY non configurée dans le .env.' };
	try {
		const { files } = await client.files(galleryPath());
		const images: GalleryImage[] = files
			.filter((f) => f.kind === 'IMAGE')
			.map((f) => ({
				// The 1200 px version: sharp enough for the grid and the lightbox, light enough to load.
				src: f.versions.medium?.url ?? f.url,
				alt: altOf(f.name)
			}));
		return { images, error: null };
	} catch (err) {
		const message = err instanceof HubError ? err.message : 'Galerie indisponible.';
		return { images: [] as GalleryImage[], error: message };
	}
};
