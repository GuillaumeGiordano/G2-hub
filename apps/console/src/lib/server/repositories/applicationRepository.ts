import { prisma } from '$lib/server/db';

// Applications — Prisma queries only, always scoped by organization (DECISIONS.md §13): an id that
// belongs to another organization matches nothing.

const listSelect = { id: true, name: true, slug: true, allowedOrigins: true, createdAt: true } as const;

export function listApplications(organizationId: string) {
	return prisma.application.findMany({
		where: { organizationId },
		orderBy: { name: 'asc' },
		select: listSelect
	});
}

/** The ids of an organization's applications (the menu's « Mon application » link). */
export async function listApplicationIds(organizationId: string) {
	const rows = await prisma.application.findMany({ where: { organizationId }, orderBy: { name: 'asc' }, select: { id: true } });
	return rows.map((r) => r.id);
}

export function findApplication(organizationId: string, id: string) {
	return prisma.application.findFirst({
		where: { id, organizationId },
		select: { id: true, name: true }
	});
}

export async function slugTakenInOrganization(organizationId: string, slug: string, excludeId?: string) {
	const found = await prisma.application.findUnique({
		where: { organizationId_slug: { organizationId, slug } },
		select: { id: true }
	});
	return !!found && found.id !== excludeId;
}

export function createApplication(data: {
	organizationId: string;
	name: string;
	slug: string;
	allowedOrigins: string[];
}) {
	return prisma.application.create({ data, select: { name: true } });
}

/** Returns the number of rows changed (0 = not in this organization). */
export async function updateApplication(
	organizationId: string,
	id: string,
	data: { name: string; allowedOrigins: string[] }
) {
	const { count } = await prisma.application.updateMany({ where: { id, organizationId }, data });
	return count;
}

/** Returns the number of rows removed (0 = not in this organization). */
export async function deleteApplication(organizationId: string, id: string) {
	const { count } = await prisma.application.deleteMany({ where: { id, organizationId } });
	return count;
}
