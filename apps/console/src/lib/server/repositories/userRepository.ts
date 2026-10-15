import { randomUUID } from 'node:crypto';
import type { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';

// Console accounts — Prisma queries only (Better Auth owns the `user` / `account` tables; these
// writes mirror what it does for an email + password account).

export function findUserByEmail(email: string, tx: Prisma.TransactionClient = prisma) {
	return tx.user.findUnique({ where: { email }, select: { id: true, role: true } });
}

export function findUserRole(id: string, tx: Prisma.TransactionClient = prisma) {
	return tx.user.findUnique({ where: { id }, select: { role: true } });
}

/** Create an email + password account (`passwordHash` from Better Auth's hasher). */
export function createUserWithPassword(
	data: { name: string; email: string; passwordHash: string },
	tx: Prisma.TransactionClient = prisma
) {
	const id = randomUUID();
	return tx.user.create({
		data: {
			id,
			name: data.name,
			email: data.email,
			accounts: {
				create: { id: randomUUID(), accountId: id, providerId: 'credential', password: data.passwordHash }
			}
		},
		select: { id: true }
	});
}

/** How many reset links (Better Auth `verification` rows) were created for the user since `since`. */
export function countResetLinksSince(userId: string, since: Date) {
	return prisma.verification.count({
		where: { value: userId, identifier: { startsWith: 'reset-password:' }, createdAt: { gte: since } }
	});
}

/** Is this reset link (Better Auth token) still usable? */
export async function resetLinkIsValid(token: string) {
	const row = await prisma.verification.findFirst({
		where: { identifier: `reset-password:${token}`, expiresAt: { gt: new Date() } },
		select: { id: true }
	});
	return !!row;
}

/** When the account was disabled, or null (enabled / unknown). */
export async function findUserDisabledAt(id: string) {
	const user = await prisma.user.findUnique({ where: { id }, select: { disabledAt: true } });
	return user?.disabledAt ?? null;
}

export function findUserAccount(id: string) {
	return prisma.user.findUnique({
		where: { id },
		select: { id: true, name: true, email: true, role: true, disabledAt: true, emailVerified: true }
	});
}

/** Name and e-mail (the e-mail is the sign-in identifier; a taken one throws P2002). */
export function updateUserProfile(id: string, data: { name: string; email: string }) {
	return prisma.user.update({ where: { id }, data, select: { id: true } });
}

export function setUserDisabled(id: string, disabledAt: Date | null) {
	return prisma.user.update({ where: { id }, data: { disabledAt }, select: { id: true } });
}

/** Sign the account out everywhere: console sessions and the « Se connecter avec G2 Hub » grants
 *  it holds as an Admin (§26). */
export function revokeUserSessions(userId: string) {
	return prisma.$transaction([
		prisma.session.deleteMany({ where: { userId } }),
		prisma.oidcAuthCode.deleteMany({ where: { userId } }),
		prisma.oidcAccessToken.deleteMany({ where: { userId } })
	]);
}

/** Remove the account's two-factor authentication (it sets it up again at its next sign-in). */
export function resetTwoFactor(userId: string) {
	return prisma.$transaction([
		prisma.twoFactor.deleteMany({ where: { userId } }),
		prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false }, select: { id: true } })
	]);
}

/** Replace the account's pending links with a new one. Better Auth's reset endpoint accepts any
 *  `reset-password:<token>` row: an invitation is a reset link that lasts longer (§30). */
export function createInvitationLink(userId: string, token: string, expiresAt: Date) {
	return prisma.$transaction([
		prisma.verification.deleteMany({ where: { value: userId, identifier: { startsWith: 'reset-password:' } } }),
		prisma.verification.create({
			data: { id: randomUUID(), identifier: `reset-password:${token}`, value: userId, expiresAt },
			select: { id: true }
		})
	]);
}

/** The person proved they own the address (they used an e-mailed link): no longer « invited ». */
export function markEmailVerified(userId: string) {
	return prisma.user.update({ where: { id: userId }, data: { emailVerified: true }, select: { id: true } });
}

function consoleAccountsWhere(search?: string): Prisma.UserWhereInput {
	return {
		role: { not: 'superadmin' },
		...(search && {
			OR: [
				{ name: { contains: search, mode: 'insensitive' } },
				{ email: { contains: search, mode: 'insensitive' } },
				{ memberships: { some: { organization: { name: { contains: search, mode: 'insensitive' } } } } }
			]
		})
	};
}

/** Console accounts (superadmins excluded) with their organizations — the console's « Membres ». */
export function listConsoleAccounts(params: { search?: string; skip: number; take: number }) {
	return prisma.user.findMany({
		where: consoleAccountsWhere(params.search),
		orderBy: [{ name: 'asc' }, { email: 'asc' }],
		skip: params.skip,
		take: params.take,
		select: {
			id: true,
			name: true,
			email: true,
			twoFactorEnabled: true,
			emailVerified: true,
			disabledAt: true,
			memberships: { orderBy: { organization: { name: 'asc' } }, select: { organization: { select: { id: true, name: true } } } },
			sessions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true, expiresAt: true } }
		}
	});
}

export function countConsoleAccounts(search?: string) {
	return prisma.user.count({ where: consoleAccountsWhere(search) });
}

/** Delete an account (its sessions, credential and memberships cascade). */
export function deleteUser(id: string, tx: Prisma.TransactionClient = prisma) {
	return tx.user.delete({ where: { id }, select: { id: true } });
}
