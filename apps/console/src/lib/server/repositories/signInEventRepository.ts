import type { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';
import type { SignInMethod, SignInOutcome } from '$lib/records/signIns';

// Sign-in log (DECISIONS.md §40) — Prisma queries only, always scoped by organization AND
// application when read (§13).

export function createSignInEvent(data: {
	organizationId: string;
	applicationId: string;
	appUserId?: string | null;
	userId?: string | null;
	email: string;
	outcome: SignInOutcome;
	method: SignInMethod;
	ipAddress: string | null;
	userAgent: string | null;
}) {
	return prisma.signInEvent.create({ data, select: { id: true } });
}

function searchWhere(params: {
	organizationId: string;
	applicationId: string;
	search?: string;
	outcomes?: readonly SignInOutcome[];
}): Prisma.SignInEventWhereInput {
	return {
		organizationId: params.organizationId,
		applicationId: params.applicationId,
		...(params.outcomes && { outcome: { in: [...params.outcomes] } }),
		...(params.search && { email: { contains: params.search, mode: 'insensitive' } })
	};
}

export function searchSignInEvents(params: {
	organizationId: string;
	applicationId: string;
	search?: string;
	outcomes?: readonly SignInOutcome[];
	skip: number;
	take: number;
}) {
	return prisma.signInEvent.findMany({
		where: searchWhere(params),
		orderBy: { createdAt: 'desc' },
		skip: params.skip,
		take: params.take,
		select: {
			id: true,
			createdAt: true,
			email: true,
			outcome: true,
			method: true,
			ipAddress: true,
			userAgent: true,
			appUser: { select: { name: true } },
			user: { select: { name: true } }
		}
	});
}

export function countSignInEvents(params: {
	organizationId: string;
	applicationId: string;
	search?: string;
	outcomes?: readonly SignInOutcome[];
}) {
	return prisma.signInEvent.count({ where: searchWhere(params) });
}

/** Events older than `before` are deleted (retention, §40). */
export async function purgeSignInEventsBefore(before: Date): Promise<number> {
	const { count } = await prisma.signInEvent.deleteMany({ where: { createdAt: { lt: before } } });
	return count;
}
