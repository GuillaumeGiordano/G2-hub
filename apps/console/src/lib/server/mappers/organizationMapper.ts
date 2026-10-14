import type { OrgRole } from '$lib/records/organization';
import type { ActiveOrganization, OrganizationListItem } from '$lib/viewmodels/organization';

type OrganizationRow = {
	id: string;
	name: string;
	slug: string;
	quotaBytes: bigint;
	storageEnabled: boolean;
};

type OrganizationListRow = OrganizationRow & {
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
