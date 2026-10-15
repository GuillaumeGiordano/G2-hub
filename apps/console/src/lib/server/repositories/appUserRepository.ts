import type { Prisma } from '@g2-hub/db';
import type { AppUserRole } from '$lib/records/appUsers';
import { prisma } from '$lib/server/db';

// Application users (portal end users) and their e-mailed links — Prisma queries only. Console
// queries are scoped by organization AND application (§13); the lookup of a link by its hash is the
// public pages' entry point (the token itself identifies the user).

type TokenPurpose = 'INVITATION' | 'PASSWORD_RESET';

function searchWhere(organizationId: string, applicationId: string, search?: string): Prisma.AppUserWhereInput {
	return {
		organizationId,
		applicationId,
		...(search && {
			OR: [
				{ name: { contains: search, mode: 'insensitive' } },
				{ email: { contains: search, mode: 'insensitive' } }
			]
		})
	};
}

export function searchAppUsers(params: {
	organizationId: string;
	applicationId: string;
	search?: string;
	skip: number;
	take: number;
}) {
	return prisma.appUser.findMany({
		where: searchWhere(params.organizationId, params.applicationId, params.search),
		orderBy: [{ name: 'asc' }, { email: 'asc' }],
		skip: params.skip,
		take: params.take,
		select: {
			id: true,
			role: true,
			name: true,
			email: true,
			passwordHash: true,
			disabledAt: true,
			lastLoginAt: true,
			createdAt: true,
			// The latest unused invitation link (to flag an expired one).
			// An access token still valid = signed in to the portal within the last hour.
			accessTokens: { where: { expiresAt: { gt: new Date() } }, take: 1, select: { id: true } },
			tokens: {
				where: { purpose: 'INVITATION', usedAt: null },
				orderBy: { createdAt: 'desc' },
				take: 1,
				select: { expiresAt: true }
			}
		}
	});
}

export function countAppUsers(organizationId: string, applicationId: string, search?: string) {
	return prisma.appUser.count({ where: searchWhere(organizationId, applicationId, search) });
}

const userSelect = {
	id: true,
	applicationId: true,
	name: true,
	email: true,
	role: true,
	passwordHash: true,
	disabledAt: true
} as const;

/** A user of THIS organization, or null (another organization's id matches nothing). */
export function findAppUser(organizationId: string, id: string) {
	return prisma.appUser.findFirst({ where: { id, organizationId }, select: userSelect });
}

export function findAppUserByEmail(applicationId: string, email: string) {
	return prisma.appUser.findUnique({
		where: { applicationId_email: { applicationId, email } },
		select: userSelect
	});
}

export function createAppUser(
	data: {
		organizationId: string;
		applicationId: string;
		email: string;
		name: string;
		role: AppUserRole;
		invitedById: string | null;
	},
	tx: Prisma.TransactionClient = prisma
) {
	return tx.appUser.create({ data, select: { id: true } });
}

/** Returns the number of rows changed (0 = not in this organization / application). */
export async function setDisabled(organizationId: string, applicationId: string, id: string, disabledAt: Date | null) {
	const { count } = await prisma.appUser.updateMany({
		where: { id, organizationId, applicationId },
		data: { disabledAt }
	});
	return count;
}

/** Returns the number of rows changed (0 = not in this organization / application). A taken e-mail
 *  throws P2002 (unique application + e-mail). */
export async function updateAppUser(
	organizationId: string,
	applicationId: string,
	id: string,
	data: { name: string; email: string; role: AppUserRole }
) {
	const { count } = await prisma.appUser.updateMany({ where: { id, organizationId, applicationId }, data });
	return count;
}

/** A user's sign-in codes and access tokens stop working at once (disabled, account edited, or
 *  « Révoquer les sessions »). */
export async function revokeGrants(appUserId: string) {
	await prisma.$transaction([
		prisma.oidcAuthCode.deleteMany({ where: { appUserId } }),
		prisma.oidcAccessToken.deleteMany({ where: { appUserId } })
	]);
}

/** Returns the number of rows removed (0 = not in this organization / application). */
export async function deleteAppUser(organizationId: string, applicationId: string, id: string) {
	const { count } = await prisma.appUser.deleteMany({ where: { id, organizationId, applicationId } });
	return count;
}

// ─── E-mailed links ───────────────────────────────────────────────────────────

export function createToken(
	data: { appUserId: string; purpose: TokenPurpose; hash: string; expiresAt: Date },
	tx: Prisma.TransactionClient = prisma
) {
	return tx.appUserToken.create({ data, select: { id: true } });
}

/** Mark a user's unused links as used (a newer link, a disabled account…). `purpose` omitted = all. */
export function revokeTokens(appUserId: string, purpose?: TokenPurpose, tx: Prisma.TransactionClient = prisma) {
	return tx.appUserToken.updateMany({
		where: { appUserId, usedAt: null, ...(purpose && { purpose }) },
		data: { usedAt: new Date() }
	});
}

export function findTokenByHash(hash: string) {
	return prisma.appUserToken.findUnique({
		where: { hash },
		select: {
			id: true,
			purpose: true,
			expiresAt: true,
			usedAt: true,
			appUser: {
				select: {
					id: true,
					name: true,
					email: true,
					passwordHash: true,
					disabledAt: true,
					application: { select: { name: true } }
				}
			}
		}
	});
}

/**
 * Use a link: mark it used and set the password, atomically. Marking it used only if it is still
 * unused makes a double submission (two tabs, a replayed request) fail instead of succeeding twice.
 * Every other open link of the user is revoked at the same time. Returns false if already used.
 */
export function useTokenAndSetPassword(tokenId: string, appUserId: string, passwordHash: string) {
	return prisma.$transaction(async (tx) => {
		const { count } = await tx.appUserToken.updateMany({
			where: { id: tokenId, usedAt: null },
			data: { usedAt: new Date() }
		});
		if (count === 0) return false;
		await tx.appUser.update({ where: { id: appUserId }, data: { passwordHash }, select: { id: true } });
		await revokeTokens(appUserId, undefined, tx);
		return true;
	});
}

/** Was a link of this purpose sent to the user since `since`? (throttles « mot de passe oublié »). */
export async function sentTokenSince(appUserId: string, purpose: TokenPurpose, since: Date) {
	const found = await prisma.appUserToken.findFirst({
		where: { appUserId, purpose, createdAt: { gte: since } },
		select: { id: true }
	});
	return !!found;
}

/** An application by id, for the public pages (name only). */
export function findApplicationName(id: string) {
	return prisma.application.findUnique({ where: { id }, select: { id: true, name: true } });
}
