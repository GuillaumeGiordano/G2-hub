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

/** Every folder of an application (to build the folder filter with full paths). */
export function listAllFolders(organizationId: string, applicationId: string) {
	return prisma.folder.findMany({
		where: { organizationId, applicationId },
		select: { id: true, name: true, parentId: true }
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

/** The child of `parentId` named `name` (case-insensitive) — resolves API paths ("Galerie/2026"). */
export function findChildByName(
	organizationId: string,
	applicationId: string,
	parentId: string | null,
	name: string
) {
	return prisma.folder.findFirst({
		where: { organizationId, applicationId, parentId, name: { equals: name, mode: 'insensitive' } },
		select: { id: true, name: true, parentId: true, visibility: true }
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

/** Ids of a folder and of every folder below it (breadth-first, one query per level). */
export async function listSubtreeIds(organizationId: string, rootId: string): Promise<string[]> {
	const ids = [rootId];
	for (let level = [rootId]; level.length; ) {
		const children = await prisma.folder.findMany({
			where: { organizationId, parentId: { in: level } },
			select: { id: true }
		});
		level = children.map((c) => c.id);
		ids.push(...level);
	}
	return ids;
}

/** Delete a folder and, by cascade, its whole subtree. Returns 0 if not in this organization. */
export async function deleteFolder(organizationId: string, id: string) {
	const { count } = await prisma.folder.deleteMany({ where: { id, organizationId } });
	return count;
}
