import type { PlatformAccess } from '$lib/records/platform';

/** « Se connecter avec G2 Hub » settings of an application (console, owners). */
export type SsoSettings = {
	application: { id: string; name: string; platformAccess: PlatformAccess };
	enabled: boolean;
	/** The application id — public, goes in the portal's configuration. */
	clientId: string;
	/** First characters of the current secret, to recognize it. */
	secretPrefix: string | null;
	redirectUris: string[];
	/** The hub's issuer URL (the portal's OIDC library discovers everything from it). */
	issuer: string;
};
