import type { Visibility } from '$lib/records/storage';
import { prisma } from '$lib/server/db';

// Folders — Prisma queries only, always scoped by organization (DECISIONS.md §13): an id that
// belongs to another organization matches nothing.

export function findFolder(organizationId: string, id: string) {
	return prisma.folder.findFirst({
		where: { id, organizationId },
		select: { id: true, name: true, applicationId: true, parentId: true, visibility: true }
	});
}

/** Direct children of `parentId` (null = the application's root folders). */
export function listChildren(organizationId: string, applicationId: string, parentId: string | null) {
	return prisma.folder.findMany({
		where: { organizationId, applicationId, parentId },
		orderBy: { name: 'asc' },
		select: { id: true, name: true, visibility: true, _count: { select: { children: true } } }
	});
}

/** Case-insensitive name clash among the siblings (a root folder's siblings are the other roots). */
export async function nameTaken(
	organizationId: string,
	applicationId: string,
	parentId: string | null,
	name: string,
	excludeId?: string
) {
	const found = await prisma.folder.findFirst({
		where: {
			organizationId,
			applicationId,
			parentId,
			name: { equals: name, mode: 'insensitive' },
			...(excludeId ? { id: { not: excludeId } } : {})
		},
		select: { id: true }
	});
	return !!found;
}

export function createFolder(data: {
	organizationId: string;
	applicationId: string;
	parentId: string | null;
	name: string;
	visibility: Visibility;
}) {
	return prisma.folder.create({ data, select: { id: true, name: true } });
}

/** Returns the number of rows changed (0 = not in this organization). */
export async function renameFolder(organizationId: string, id: string, name: string) {
	const { count } = await prisma.folder.updateMany({ where: { id, organizationId }, data: { name } });
	return count;
}

/** Delete a folder and, by cascade, its whole subtree. Returns 0 if not in this organization. */
export async function deleteFolder(organizationId: string, id: string) {
	const { count } = await prisma.folder.deleteMany({ where: { id, organizationId } });
	return count;
}
