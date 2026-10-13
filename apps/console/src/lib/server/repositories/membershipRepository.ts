import type { Prisma } from '@g2-hub/db';
import type { OrgRole } from '$lib/records/organization';
import { prisma } from '$lib/server/db';

// Memberships — Prisma queries only. Every write is scoped by organization: an id that belongs to
// another organization matches nothing (tenant isolation, DECISIONS.md §13).

/** All the organizations a user belongs to, with its role in each. */
export function findMembershipsOfUser(userId: string) {
	return prisma.membership.findMany({
		where: { userId },
		orderBy: { organization: { name: 'asc' } },
		select: { organizationId: true, role: true }
	});
}

export function findMembership(organizationId: string, userId: string) {
	return prisma.membership.findUnique({
		where: { organizationId_userId: { organizationId, userId } },
		select: { id: true, role: true }
	});
}

export function listMembers(organizationId: string) {
	return prisma.membership.findMany({
		where: { organizationId },
		orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
		select: {
			id: true,
			role: true,
			user: { select: { id: true, name: true, email: true, twoFactorEnabled: true } }
		}
	});
}

export function findMemberInOrganization(organizationId: string, membershipId: string) {
	return prisma.membership.findFirst({
		where: { id: membershipId, organizationId },
		select: { id: true, role: true, userId: true, user: { select: { email: true } } }
	});
}

export function countOwners(organizationId: string) {
	return prisma.membership.count({ where: { organizationId, role: 'OWNER' } });
}

export function countMembershipsOfUser(userId: string, tx: Prisma.TransactionClient = prisma) {
	return tx.membership.count({ where: { userId } });
}

export function createMembership(
	data: { organizationId: string; userId: string; role: OrgRole },
	tx: Prisma.TransactionClient = prisma
) {
	return tx.membership.create({ data, select: { id: true } });
}

/** Returns the number of rows changed (0 = not in this organization). */
export async function updateRole(organizationId: string, membershipId: string, role: OrgRole) {
	const { count } = await prisma.membership.updateMany({
		where: { id: membershipId, organizationId },
		data: { role }
	});
	return count;
}

/** Returns the number of rows removed (0 = not in this organization). */
export async function deleteMembership(
	organizationId: string,
	membershipId: string,
	tx: Prisma.TransactionClient = prisma
) {
	const { count } = await tx.membership.deleteMany({ where: { id: membershipId, organizationId } });
	return count;
}
