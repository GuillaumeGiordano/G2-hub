import type { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';

// « Se connecter avec G2 Hub » (OIDC) — Prisma queries only. The console queries are scoped by
// organization (§13); the protocol endpoints start from what the portal sends (client_id = the
// application id, a code or a token hash) and are then bound to THAT application.

// ─── Console: SSO settings of an application ─────────────────────────────────

export function findSsoSettings(organizationId: string, applicationId: string) {
	return prisma.application.findFirst({
		where: { id: applicationId, organizationId },
		select: { id: true, name: true, ssoSecretHash: true, ssoSecretPrefix: true, ssoRedirectUris: true }
	});
}

/** Returns the number of rows changed (0 = not in this organization). */
export async function updateSsoSettings(
	organizationId: string,
	applicationId: string,
	data: { ssoSecretHash?: string | null; ssoSecretPrefix?: string | null; ssoRedirectUris?: string[] }
) {
	const { count } = await prisma.application.updateMany({ where: { id: applicationId, organizationId }, data });
	return count;
}

/** Sign-in is turned off: codes and tokens already issued stop working. */
export async function revokeApplicationGrants(applicationId: string) {
	await prisma.$transaction([
		prisma.oidcAuthCode.deleteMany({ where: { applicationId } }),
		prisma.oidcAccessToken.deleteMany({ where: { applicationId } })
	]);
}

// ─── Protocol ────────────────────────────────────────────────────────────────

/** An application with sign-in enabled (`client_id`), or null. */
export function findSsoClient(applicationId: string) {
	return prisma.application.findFirst({
		where: { id: applicationId, ssoSecretHash: { not: null } },
		select: {
			id: true,
			name: true,
			organizationId: true,
			platformAccess: true,
			ssoSecretHash: true,
			ssoRedirectUris: true
		}
	});
}

/** Who may enter an application with their console session (§26, §38) — the rule itself is
 *  oidcService.consoleAccess. */
export function findPlatformApplication(applicationId: string) {
	return prisma.application.findUnique({
		where: { id: applicationId },
		select: { id: true, organizationId: true, platformAccess: true }
	});
}

/**
 * A console account and the organizations it is an Admin of. Read at sign-in AND at every later
 * use of a code or token, so a member removed from an organization loses access at once.
 */
export function findConsoleAccount(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			twoFactorEnabled: true,
			disabledAt: true,
			memberships: {
				where: { role: 'OWNER' },
				orderBy: { organization: { name: 'asc' } },
				select: { organization: { select: { id: true, name: true } } }
			}
		}
	});
}

/** Every organization (the superadmin may enter a tool for any of them, §38). */
export function listOrganizations() {
	return prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

/** The organizations a tool is enabled for (§38). */
export async function findToolOrganizationIds(applicationId: string): Promise<Set<string>> {
	const rows = await prisma.organizationTool.findMany({ where: { applicationId }, select: { organizationId: true } });
	return new Set(rows.map((r) => r.organizationId));
}

/** Who a code / token was issued to: exactly one of the two is set (CHECK constraint) — and, for
 *  a tool, the organization the member entered it for (§38). */
const holderSelect = {
	appUser: { select: { id: true, email: true, name: true, role: true, passwordHash: true, disabledAt: true } },
	user: { select: { id: true, email: true, name: true } },
	organizationId: true
} as const;

export function createAuthCode(data: {
	hash: string;
	applicationId: string;
	appUserId?: string;
	userId?: string;
	organizationId?: string;
	redirectUri: string;
	codeChallenge: string;
	nonce: string | null;
	scope: string;
	authTime: Date;
	expiresAt: Date;
}) {
	return prisma.oidcAuthCode.create({ data, select: { id: true } });
}

export function findAuthCode(hash: string) {
	return prisma.oidcAuthCode.findUnique({
		where: { hash },
		select: {
			id: true,
			applicationId: true,
			redirectUri: true,
			codeChallenge: true,
			nonce: true,
			scope: true,
			authTime: true,
			expiresAt: true,
			usedAt: true,
			...holderSelect
		}
	});
}

/** Mark a code used only if it still is unused: a replayed code loses the race. */
export async function useAuthCode(id: string): Promise<boolean> {
	const { count } = await prisma.oidcAuthCode.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
	return count === 1;
}

export function createAccessToken(data: {
	hash: string;
	applicationId: string;
	appUserId?: string;
	userId?: string;
	organizationId?: string;
	scope: string;
	expiresAt: Date;
}) {
	return prisma.oidcAccessToken.create({ data, select: { id: true } });
}

export function findAccessToken(hash: string) {
	return prisma.oidcAccessToken.findUnique({
		where: { hash },
		select: {
			applicationId: true,
			scope: true,
			expiresAt: true,
			...holderSelect
		}
	});
}

export function touchLastLogin(appUserId: string) {
	return prisma.appUser.update({ where: { id: appUserId }, data: { lastLoginAt: new Date() }, select: { id: true } });
}

/** Expired codes and tokens are useless: removed periodically by the worker. */
export async function purgeExpired(now = new Date()): Promise<number> {
	const [codes, tokens] = await prisma.$transaction([
		prisma.oidcAuthCode.deleteMany({ where: { expiresAt: { lt: now } } }),
		prisma.oidcAccessToken.deleteMany({ where: { expiresAt: { lt: now } } })
	]);
	return codes.count + tokens.count;
}

// ─── Signing key ─────────────────────────────────────────────────────────────

export function findSigningKeys() {
	return prisma.oidcSigningKey.findMany({ orderBy: { createdAt: 'asc' } });
}

/** Insert unless a key with this id exists (two processes generating at once keep one). */
export function insertSigningKey(data: { kid: string; publicJwk: Prisma.InputJsonValue; privateKeyPem: string }) {
	return prisma.oidcSigningKey.createMany({ data: [data], skipDuplicates: true });
}
