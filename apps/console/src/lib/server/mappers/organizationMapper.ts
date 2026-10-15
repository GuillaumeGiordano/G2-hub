import { LEGAL_FORMS, type LegalForm, type OrganizationStatus, type OrgRole } from '$lib/records/organization';
import type {
	ActiveOrganization,
	OrganizationContract,
	OrganizationListItem,
	OrganizationProfile
} from '$lib/viewmodels/organization';

type OrganizationRow = {
	id: string;
	name: string;
	slug: string;
	quotaBytes: bigint;
	storageEnabled: boolean;
};

type OrganizationListRow = OrganizationRow & {
	status: OrganizationStatus;
	_count: { memberships: number; applications: number; files: number };
	memberships: { role: OrgRole }[];
};

export function toOrganizationListItem(row: OrganizationListRow, usedBytes: bigint): OrganizationListItem {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		// BigInt does not serialize to the page; a quota (≤ 20 GB) fits a JS number exactly.
		quotaBytes: Number(row.quotaBytes),
		usedBytes: Number(usedBytes),
		storageEnabled: row.storageEnabled,
		status: row.status,
		memberCount: row._count.memberships,
		applicationCount: row._count.applications,
		siteFileCount: row._count.files,
		myRole: row.memberships[0]?.role ?? null
	};
}

export function toActiveOrganization(row: OrganizationRow, role: OrgRole | null): ActiveOrganization {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		quotaBytes: Number(row.quotaBytes),
		storageEnabled: row.storageEnabled,
		role
	};
}

type ProfileRow = Omit<OrganizationProfile, 'legalForm'> & {
	legalForm: string | null;
	status: OrganizationStatus;
	contractStartedAt: Date | null;
	internalNotes: string | null;
};

export function toOrganizationProfile(row: ProfileRow): OrganizationProfile {
	return {
		legalName: row.legalName,
		legalForm: (LEGAL_FORMS as readonly string[]).includes(row.legalForm ?? '') ? (row.legalForm as LegalForm) : null,
		siret: row.siret,
		vatNumber: row.vatNumber,
		nafCode: row.nafCode,
		email: row.email,
		phone: row.phone,
		website: row.website,
		addressLine1: row.addressLine1,
		addressLine2: row.addressLine2,
		postalCode: row.postalCode,
		city: row.city,
		country: row.country,
		billingSameAddress: row.billingSameAddress,
		billingAddressLine1: row.billingAddressLine1,
		billingAddressLine2: row.billingAddressLine2,
		billingPostalCode: row.billingPostalCode,
		billingCity: row.billingCity,
		billingCountry: row.billingCountry,
		billingEmail: row.billingEmail,
		billingContactName: row.billingContactName,
		purchaseOrderRef: row.purchaseOrderRef,
		contactName: row.contactName,
		contactRole: row.contactRole,
		contactEmail: row.contactEmail,
		contactPhone: row.contactPhone,
		dpoName: row.dpoName,
		dpoEmail: row.dpoEmail
	};
}

/** The internal notes never leave the server for anyone but the superadmin. */
export function toOrganizationContract(row: ProfileRow, isSuperadmin: boolean): OrganizationContract {
	return {
		status: row.status,
		contractStartedAt: row.contractStartedAt ? row.contractStartedAt.toISOString().slice(0, 10) : null,
		internalNotes: isSuperadmin ? row.internalNotes : null
	};
}
