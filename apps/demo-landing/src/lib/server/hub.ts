import { createHubClient, type HubClient } from '@g2/hub-client';
import { env } from '$env/dynamic/private';

// The demo site's G2 Hub clients — one per process, so the "last good answer" fallback survives
// between requests: if the hub is down, the gallery keeps showing the last photos received.
const baseUrl = () => env.DEMO_HUB_URL || 'http://localhost:5180';

let publicClient: HubClient | null = null;
let adminClient: HubClient | null = null;

/** Public pages: a publishable key (reads the public gallery). */
export function hub(): HubClient | null {
	if (!env.DEMO_HUB_KEY) return null;
	publicClient ??= createHubClient({ baseUrl: baseUrl(), key: env.DEMO_HUB_KEY });
	return publicClient;
}

/** The site's admin: a SECRET key (uploads, edits, deletes) — server-side only. */
export function hubAdmin(): HubClient | null {
	if (!env.DEMO_HUB_SECRET_KEY) return null;
	adminClient ??= createHubClient({ baseUrl: baseUrl(), key: env.DEMO_HUB_SECRET_KEY });
	return adminClient;
}

export const galleryPath = () => env.DEMO_GALLERY_PATH || 'Galerie';
