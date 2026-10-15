import { createHubClient, type HubClient } from '@g2/hub-client';
import { env } from '$env/dynamic/private';

// The portal's G2 Hub client: the application's SECRET key (server-side only — the same application
// as the « Se connecter avec G2 Hub » client). Alone it opens no personal space: each call is made
// `asUser(accessToken)`, the token of the user signed in (DECISIONS.md §28).
let client: HubClient | null = null;

export function hub(): HubClient | null {
	if (!env.DEMO_HUB_SECRET_KEY) return null;
	client ??= createHubClient({ baseUrl: env.DEMO_HUB_URL || 'http://localhost:5180', key: env.DEMO_HUB_SECRET_KEY });
	return client;
}

/** An avatar is a small image: the portal checks its own limit before sending it to the hub. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** The site's gallery (the folder the landing page shows) — managed by the admins on /admin/galerie. */
export const galleryPath = () => env.DEMO_GALLERY_PATH || 'Galerie';
export const GALLERY_MAX_BYTES = 10 * 1024 * 1024;
export const GALLERY_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
