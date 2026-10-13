import { prisma } from '$lib/server/db';

// Sessions — Prisma queries only. The active organization lives on the session row: it is only
// ever written server-side, after the membership has been checked (DECISIONS.md §13).

export function setActiveOrganization(sessionId: string, organizationId: string | null) {
	return prisma.session.update({
		where: { id: sessionId },
		data: { activeOrganizationId: organizationId },
		select: { id: true }
	});
}
