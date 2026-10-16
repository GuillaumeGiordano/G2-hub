import { prisma } from '$lib/server/db';
import type { PlatformAccess } from '$lib/records/platform';

// Applications of the platform (DECISIONS.md §38) — Prisma queries only. The settings are scoped
// by the organization owning the application (§13); a tool is enabled for ANOTHER organization,
// so those queries start from that organization and only ever read the tool's public fields.

export function findPlatformSettings(organizationId: string, applicationId: string) {
	return prisma.application.findFirst({
		where: { id: applicationId, organizationId },
		select: { id: true, platformAccess: true, homeUrl: true }
	});
}

/** Returns the number of rows changed (0 = not in this organization). */
export async function updatePlatformSettings(
	organizationId: string,
	applicationId: string,
	data: { platformAccess: PlatformAccess; homeUrl: string | null }
) {
	const { count } = await prisma.application.updateMany({ where: { id: applicationId, organizationId }, data });
	return count;
}

/** Every tool of the instance, and whether it is enabled for `organizationId`. */
export function listTools(organizationId: string) {
	return prisma.application.findMany({
		where: { platformAccess: 'PER_ORGANIZATION' },
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			homeUrl: true,
			organizationId: true,
			organization: { select: { name: true } },
			enabledFor: { where: { organizationId }, select: { enabledAt: true } }
		}
	});
}

export function findTool(applicationId: string) {
	return prisma.application.findFirst({
		where: { id: applicationId, platformAccess: 'PER_ORGANIZATION' },
		select: { id: true, name: true }
	});
}

export function enableTool(organizationId: string, applicationId: string) {
	return prisma.organizationTool.createMany({ data: [{ organizationId, applicationId }], skipDuplicates: true });
}

export function disableTool(organizationId: string, applicationId: string) {
	return prisma.organizationTool.deleteMany({ where: { organizationId, applicationId } });
}

/** What the launcher of `organizationId` shows: the client portals, and the tools enabled for it
 *  (or owned by it) — every tool when `allTools` (the superadmin). Only those with an address. */
export function listLauncherApplications(organizationId: string, allTools: boolean) {
	return prisma.application.findMany({
		where: {
			homeUrl: { not: null },
			OR: [
				{ platformAccess: 'ALL_ADMINS' },
				{
					platformAccess: 'PER_ORGANIZATION',
					...(allTools ? {} : { OR: [{ organizationId }, { enabledFor: { some: { organizationId } } }] })
				}
			]
		},
		orderBy: { name: 'asc' },
		select: { id: true, name: true, platformAccess: true, homeUrl: true }
	});
}
