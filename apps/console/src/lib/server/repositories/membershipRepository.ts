import type { Prisma } from '@g2-hub/db';
import type { OrgRole } from '$lib/records/organization';
import { prisma } from '$lib/server/db';

// Memberships — Prisma queries only. Every write is scoped by organization: an id that belongs to
// another organization matches nothing (tenant isolation, DECISIONS.md §13). The superadmin's own
// memberships are never listed nor counted: it is invisible to the organizations (§34).

const NOT_SUPERADMIN = { role: { not: 'superadmin' } };

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

export function listMembers(organizationId: string, search?: string) {
	return prisma.membership.findMany({
		where: {
			organizationId,
			user: {
				...NOT_SUPERADMIN,
				...(search && {
					OR: [
						{ name: { contains: search, mode: 'insensitive' } },
						{ email: { contains: search, mode: 'insensitive' } }
					]
				})
			}
		},
		orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
		select: {
			id: true,
			role: true,
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					twoFactorEnabled: true,
					// false until the person used their invitation (or a reset) link (§30).
					emailVerified: true,
					disabledAt: true,
					// In how many organizations: more than one = a shared account (§30).
					_count: { select: { memberships: true } },
					// The most recently active session (Better Auth refreshes `updatedAt` while it is used).
					sessions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true, expiresAt: true } }
				}
			}
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
	return prisma.membership.count({ where: { organizationId, role: 'OWNER', user: NOT_SUPERADMIN } });
}

/** Admins whose account is not disabled: an organization always keeps at least one. */
export function countActiveOwners(organizationId: string) {
	return prisma.membership.count({ where: { organizationId, role: 'OWNER', user: { ...NOT_SUPERADMIN, disabledAt: null } } });
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

/** Returns the number of rows removed (0 = not in this organization). */
export async function deleteMembership(
	organizationId: string,
	membershipId: string,
	tx: Prisma.TransactionClient = prisma
) {
	const { count } = await tx.membership.deleteMany({ where: { id: membershipId, organizationId } });
	return count;
}
