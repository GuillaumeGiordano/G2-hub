import type { OrgRole } from '$lib/records/organization';

/** A row of the organizations list. */
export type OrganizationListItem = {
	id: string;
	name: string;
	slug: string;
	quotaBytes: number;
	/** Bytes counted toward the quota (all its applications). */
	usedBytes: number;
	storageEnabled: boolean;
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
