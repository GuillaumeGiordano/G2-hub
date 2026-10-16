import type { PlatformAccess } from '$lib/records/platform';

/** « Application de la plateforme » settings of an application (superadmin, §38). */
export type PlatformSettings = {
	platformAccess: PlatformAccess;
	homeUrl: string | null;
};

/** A tool of the platform, and whether it is enabled for the organization open (superadmin). */
export type OrganizationToolItem = {
	id: string;
	name: string;
	/** The organization that owns it (G2 Webdev on the shared instance). */
	ownerName: string;
	enabled: boolean;
	/** Its own organization always has it: it cannot be disabled there. */
	owned: boolean;
	/** Where the launcher opens it for this organization; null without an entry address. */
	url: string | null;
};

/** A card of the « Outils » launcher: the client portal, or a tool for THIS organization. */
export type LauncherItem = {
	id: string;
	name: string;
	kind: 'portal' | 'tool';
	url: string;
};
