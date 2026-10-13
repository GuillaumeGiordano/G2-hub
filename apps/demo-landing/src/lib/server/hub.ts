import { createHubClient, type HubClient } from '@g2/hub-client';
import { env } from '$env/dynamic/private';

// The demo site's G2 Hub client — one per process, so its "last good answer" fallback survives
// between requests: if the hub is down, the gallery keeps showing the last photos received.
let client: HubClient | null = null;

export function hub(): HubClient | null {
	if (!env.DEMO_HUB_KEY) return null;
	client ??= createHubClient({ baseUrl: env.DEMO_HUB_URL || 'http://localhost:5180', key: env.DEMO_HUB_KEY });
	return client;
}

export const galleryPath = () => env.DEMO_GALLERY_PATH || 'Galerie';
