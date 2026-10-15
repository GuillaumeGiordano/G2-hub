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
			storageEnabled: true,
			_count: { select: { memberships: true, applications: true, files: { where: { source: 'API' } } } },
			memberships: { where: { userId: params.userId }, select: { role: true } }
		}
	});
}

/** The organizations a user belongs to (names only: what the « choose » page lists). */
export function listOrganizationsOfUser(userId: string) {
	return prisma.organization.findMany({
		where: { memberships: { some: { userId } } },
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});
}

/** How many applications and members an organization has. */
export async function countsOf(id: string) {
	const row = await prisma.organization.findUnique({
		where: { id },
		select: { _count: { select: { applications: true, memberships: true } } }
	});
	return { applications: row?._count.applications ?? 0, members: row?._count.memberships ?? 0 };
}

export function countOrganizations(search: string | undefined, visibleTo: string | null) {
	return prisma.organization.count({ where: visibleWhere(search, visibleTo) });
}

export function findOrganizationById(id: string) {
	return prisma.organization.findUnique({
		where: { id },
		select: { id: true, name: true, slug: true, quotaBytes: true, storageEnabled: true }
	});
}

export async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
	const found = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
	return !!found && found.id !== excludeId;
}

export function createOrganization(
	tx: Prisma.TransactionClient,
	data: { name: string; slug: string; quotaBytes: bigint; storageEnabled: boolean }
) {
	return tx.organization.create({ data, select: { id: true, name: true } });
}

export function updateOrganization(
	id: string,
	data: { name: string; quotaBytes: bigint; storageEnabled: boolean }
) {
	return prisma.organization.update({ where: { id }, data, select: { name: true } });
}

// ─── Internal API (G2 WebDev portal, instance token — no organization scope by design) ───

const billingSelect = {
	id: true,
	name: true,
	slug: true,
	quotaBytes: true,
	storageEnabled: true,
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

/** The plan only (tier + storage option) — what the portal changes after a payment. */
export function updatePlan(id: string, data: { quotaBytes?: bigint; storageEnabled?: boolean }) {
	return prisma.organization.update({ where: { id }, data, select: { id: true } });
}

export function deleteOrganization(id: string) {
	return prisma.organization.delete({ where: { id }, select: { name: true } });
}
