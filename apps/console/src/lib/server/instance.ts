import { env } from '$env/dynamic/private';

// Instance-level settings: one G2 Hub install (the shared G2 WebDev instance, or a copy delivered
// to a client) is configured entirely from its .env — nothing instance-specific is hard-coded.

/** Name shown in the console (titles, login screen, 2FA issuer). */
export const hubName = (): string => env.HUB_NAME || 'G2 Hub';
