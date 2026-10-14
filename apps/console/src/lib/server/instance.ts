import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// Instance-level settings: one G2 Hub install (the shared G2 WebDev instance, or a copy delivered
// to a client) is configured entirely from its .env — nothing instance-specific is hard-coded.

/** Name shown in the console (titles, login screen, 2FA issuer). */
export const hubName = (): string => env.HUB_NAME || 'G2 Hub';

/** Public URL of the hub (Better Auth base URL, links sent by e-mail). Dev falls back to the
 *  console's dev server. */
export const hubUrl = (): string => env.ORIGIN || (dev ? 'http://localhost:5180' : '');

/** Where an Admin asks for more space (« Demander plus d'espace »): the G2 WebDev portal, a contact
 *  page or a mailto:. Empty = no button (e.g. a copy delivered to a client). */
export const upgradeUrl = (): string | null => env.UPGRADE_URL || null;
