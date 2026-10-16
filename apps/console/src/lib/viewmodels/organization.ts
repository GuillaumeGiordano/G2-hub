import type { OrganizationStatus, OrgRole } from '$lib/records/organization';

/** A row of the organizations list. */
export type OrganizationListItem = {
	id: string;
	name: string;
	slug: string;
	quotaBytes: number;
	/** Bytes counted toward the quota (all its applications). */
	usedBytes: number;
	storageEnabled: boolean;
	status: OrganizationStatus;
	memberCount: number;
	applicationCount: number;
	/** Files its sites uploaded through the API — lost if the organization is deleted (§22). */
	siteFileCount: number;
	/** The current user's role in it (null for the superadmin when not a member). */
	myRole: OrgRole | null;
};

/** The organization the console is working in (from the session, checked by the hook). */
export type ActiveOrganization = {
	id: string;
	name: string;
	slug: string;
	quotaBytes: number;
	storageEnabled: boolean;
	/** The current user's role (null for the superadmin when not a member). */
	role: OrgRole | null;
};

/** Result of creating an organization. */
export type CreatedOrganization = {
	name: string;
	ownerEmail: string;
	/** A new owner account: an invitation e-mail was sent (false = it already had an account). */
	invited: boolean;
};

/** « Mon organisation »: what every member sees about the active organization. */
export type MyOrganization = {
	id: string;
	name: string;
	slug: string;
	storageEnabled: boolean;
	quotaBytes: number;
	usedBytes: number;
	applicationCount: number;
	memberCount: number;
	/** The current user's role (null for the superadmin when not a member). */
	role: OrgRole | null;
	/** Member of several organizations: may switch to another one. */
	canSwitch: boolean;
	/** May edit the name and the logo (its Admins, the superadmin). */
	canEdit: boolean;
	/** The superadmin: also sets the status. */
	isSuperadmin: boolean;
	logoUrl: string | null;
	status: OrganizationStatus;
};

/** A card of « Mes organisations » (an Admin of several organizations, §36). */
export type MyOrganizationCard = {
	id: string;
	name: string;
	logoUrl: string | null;
	applicationCount: number;
};
