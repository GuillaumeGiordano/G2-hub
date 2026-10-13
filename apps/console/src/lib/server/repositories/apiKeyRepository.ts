import type { ApiKeyKind } from '$lib/records/apiKeys';
import { prisma } from '$lib/server/db';

// API keys — Prisma queries only. Console queries are scoped by organization (§13); the lookup by
// hash is the API's entry point (the key itself identifies its organization and application).

export function listKeys(organizationId: string, applicationId: string) {
	return prisma.apiKey.findMany({
		where: { organizationId, applicationId },
		orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
		select: { id: true, name: true, kind: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true }
	});
}

export function createKey(data: {
	organizationId: string;
	applicationId: string;
	kind: ApiKeyKind;
	name: string;
	prefix: string;
	hash: string;
	createdById: string;
}) {
	return prisma.apiKey.create({ data, select: { id: true } });
}

/** Returns the number of rows changed (0 = not in this organization / application, or already revoked). */
export async function revokeKey(organizationId: string, applicationId: string, id: string) {
	const { count } = await prisma.apiKey.updateMany({
		where: { id, organizationId, applicationId, revokedAt: null },
		data: { revokedAt: new Date() }
	});
	return count;
}

/** The active key with this hash, with what the API needs about its application and organization. */
export function findActiveKeyByHash(hash: string) {
	return prisma.apiKey.findFirst({
		where: { hash, revokedAt: null },
		select: {
			id: true,
			kind: true,
			lastUsedAt: true,
			organizationId: true,
			applicationId: true,
			application: { select: { allowedOrigins: true } },
			organization: { select: { storageEnabled: true } }
		}
	});
}

export function touchKey(id: string) {
	return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() }, select: { id: true } });
}

/** Is `origin` allowed by at least one application? (CORS preflight, before any key is known.) */
export async function anyApplicationAllowsOrigin(origin: string): Promise<boolean> {
	const found = await prisma.application.findFirst({
		where: { allowedOrigins: { has: origin } },
		select: { id: true }
	});
	return !!found;
}
