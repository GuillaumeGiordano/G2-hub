import type { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';

// Organizations — Prisma queries only. `visibleTo` scopes a listing: null = every organization
// (superadmin), a user id = only the organizations that user is a member of.

function visibleWhere(search: string | undefined, visibleTo: string | null): Prisma.OrganizationWhereInput {
	return {
		...(visibleTo ? { memberships: { some: { userId: visibleTo } } } : {}),
		...(search
			? {
					OR: [
						{ name: { contains: search, mode: 'insensitive' } },
						{ slug: { contains: search, mode: 'insensitive' } }
					]
				}
			: {})
	};
}

export function searchOrganizations(params: {
	search?: string;
	visibleTo: string | null;
	/** Whose role to return alongside each organization. */
	userId: string;
	skip: number;
	take: number;
}) {
	return prisma.organization.findMany({
		where: visibleWhere(params.search, params.visibleTo),
		orderBy: { name: 'asc' },
		skip: params.skip,
		take: params.take,
		select: {
			id: true,
			name: true,
			slug: true,
			quotaBytes: true,
			authEnabled: true,
			storageEnabled: true,
			maxAppUsers: true,
			status: true,
			// The superadmin is never counted among an organization's members (§34).
			_count: {
				select: {
					memberships: { where: { user: { role: { not: 'superadmin' } } } },
					applications: true,
					files: { where: { source: 'API' } }
				}
			},
			memberships: { where: { userId: params.userId }, select: { role: true } }
		}
	});
}

/** The organizations a user belongs to — what « Mes organisations » shows (name, logo, size). */
export function listOrganizationsOfUser(userId: string) {
	return prisma.organization.findMany({
		where: { memberships: { some: { userId } } },
		orderBy: { name: 'asc' },
		select: { id: true, name: true, logoKey: true, _count: { select: { applications: true } } }
	});
}

/** How many applications and members an organization has. */
export async function countsOf(id: string) {
	const row = await prisma.organization.findUnique({
		where: { id },
		select: { _count: { select: { applications: true, memberships: { where: { user: { role: { not: 'superadmin' } } } } } } }
	});
	return { applications: row?._count.applications ?? 0, members: row?._count.memberships ?? 0 };
}

/** What « Mon organisation » reads besides the active organization: the legal and billing profile
 *  lives in g2-erp (DECISIONS.md §31). */
export function findOrganizationProfile(id: string) {
	return prisma.organization.findUnique({ where: { id }, select: { logoKey: true, status: true } });
}

/** The name, edited by the organization's Admins. */
export function updateOrganizationName(id: string, name: string) {
	return prisma.organization.update({ where: { id }, data: { name }, select: { name: true } });
}

/** The status (superadmin) and the logo key. */
export function updateOrganizationInternal(id: string, data: Pick<Prisma.OrganizationUpdateInput, 'status' | 'logoKey'>) {
	return prisma.organization.update({ where: { id }, data, select: { name: true } });
}

/** Every organization, by name (the « organisations » choice of the console's forms). */
export function listOrganizationNames() {
	return prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

/** The organizations among these ids that exist. */
export function listOrganizationNamesByIds(ids: string[]) {
	return prisma.organization.findMany({ where: { id: { in: ids } }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

export function countOrganizations(search: string | undefined, visibleTo: string | null) {
	return prisma.organization.count({ where: visibleWhere(search, visibleTo) });
}

/** The organization an application belongs to (only to rebuild a former address). */
export async function findOrganizationIdOfApplication(applicationId: string) {
	const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { organizationId: true } });
	return app?.organizationId ?? null;
}

export function findOrganizationById(id: string) {
	return prisma.organization.findUnique({
		where: { id },
		select: { id: true, name: true, slug: true, quotaBytes: true, authEnabled: true, storageEnabled: true }
	});
}

export async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
	const found = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
	return !!found && found.id !== excludeId;
}

export function createOrganization(
	tx: Prisma.TransactionClient,
	data: {
		name: string;
		slug: string;
		quotaBytes: bigint;
		authEnabled: boolean;
		storageEnabled: boolean;
		maxAppUsers: number;
		externalRef?: string;
	}
) {
	return tx.organization.create({ data, select: { id: true, name: true } });
}

export function updateOrganization(
	id: string,
	data: { name: string; quotaBytes: bigint; authEnabled: boolean; storageEnabled: boolean; maxAppUsers: number }
) {
	return prisma.organization.update({ where: { id }, data, select: { name: true } });
}

// ─── Internal API (G2 WebDev portal, instance token — no organization scope by design) ───

const billingSelect = {
	id: true,
	name: true,
	slug: true,
	quotaBytes: true,
	authEnabled: true,
	storageEnabled: true,
	maxAppUsers: true,
	createdAt: true,
	_count: { select: { memberships: true, applications: true, appUsers: true } }
} as const;

/** Every organization of the instance, with what the portal bills on. */
export function listOrganizationsForBilling() {
	return prisma.organization.findMany({ orderBy: { name: 'asc' }, select: billingSelect });
}

export function findOrganizationForBilling(id: string) {
	return prisma.organization.findUnique({ where: { id }, select: billingSelect });
}

/** The organization g2-erp created with this reference, if any (§43). */
export function findOrganizationIdByExternalRef(externalRef: string) {
	return prisma.organization.findUnique({ where: { externalRef }, select: { id: true } });
}

/** The plan only (tier + offers) — what the portal changes after a payment. */
export function updatePlan(
	id: string,
	data: { quotaBytes?: bigint; authEnabled?: boolean; storageEnabled?: boolean; maxAppUsers?: number }
) {
	return prisma.organization.update({ where: { id }, data, select: { id: true } });
}

export function deleteOrganization(id: string) {
	return prisma.organization.delete({ where: { id }, select: { name: true } });
}
