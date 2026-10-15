import type { LegalForm, OrganizationStatus, OrgRole } from '$lib/records/organization';

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
	/** May edit the profile (its Admins, the superadmin). */
	canEdit: boolean;
	/** The superadmin: also edits the contract and reads the internal notes. */
	isSuperadmin: boolean;
	logoUrl: string | null;
	profile: OrganizationProfile;
	contract: OrganizationContract;
};

/** What the organization's Admins fill in (every field optional for now, §31). */
export type OrganizationProfile = {
	legalName: string | null;
	legalForm: LegalForm | null;
	siret: string | null;
	vatNumber: string | null;
	nafCode: string | null;
	email: string | null;
	phone: string | null;
	website: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	postalCode: string | null;
	city: string | null;
	country: string | null;
	billingSameAddress: boolean;
	billingAddressLine1: string | null;
	billingAddressLine2: string | null;
	billingPostalCode: string | null;
	billingCity: string | null;
	billingCountry: string | null;
	billingEmail: string | null;
	billingContactName: string | null;
	purchaseOrderRef: string | null;
	contactName: string | null;
	contactRole: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	dpoName: string | null;
	dpoEmail: string | null;
};

/** Written by the superadmin. `internalNotes` is null for anyone else (never sent to the page). */
export type OrganizationContract = {
	status: OrganizationStatus;
	/** YYYY-MM-DD, or null. */
	contractStartedAt: string | null;
	internalNotes: string | null;
};

/** A card of « Mes organisations » (an Admin of several organizations, §36). */
export type MyOrganizationCard = {
	id: string;
	name: string;
	logoUrl: string | null;
	applicationCount: number;
};
