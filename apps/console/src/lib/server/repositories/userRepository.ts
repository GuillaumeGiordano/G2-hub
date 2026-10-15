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

/** Delete an account (its sessions, credential and memberships cascade). */
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

export function deleteUser(id: string, tx: Prisma.TransactionClient = prisma) {
	return tx.user.delete({ where: { id }, select: { id: true } });
}
