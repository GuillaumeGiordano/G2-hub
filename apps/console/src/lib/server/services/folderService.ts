import * as appRepo from '$lib/server/repositories/applicationRepository';
import * as folderRepo from '$lib/server/repositories/folderRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import { purgeObjects } from '$lib/server/storage/purge';
import { assertCan, type OrgContext } from '$lib/server/context';
import { can } from '$lib/records/organization';
import { forbidden, HubError, notFound } from '$lib/server/errors';
import type { Visibility } from '$lib/records/storage';
import type { FolderBrowser, FolderCrumb } from '$lib/viewmodels/folder';

// Folders of an application of the ACTIVE organization (ctx comes from the session —
// DECISIONS.md §13). Nested; a subfolder always has its parent's visibility (§7). Readable by every
// member, written by its Admins. Storage is an option of the offer (§12).

/** Throw 403 when the organization did not subscribe to the storage option. */
export function assertStorageEnabled(ctx: OrgContext) {
	if (!ctx.organization.storageEnabled) {
		throw forbidden("L'option stockage n'est pas activée pour cette organisation.");
	}
}

export async function applicationOrThrow(ctx: OrgContext, applicationId: string) {
	const app = await appRepo.findApplication(ctx.organization.id, applicationId);
	if (!app) throw notFound('Application introuvable.');
	return app;
}

/** A folder of THIS application of THIS organization, or 404 — a user's personal space (§28)
 *  included: the console never opens one. */
export async function folderOrThrow(ctx: OrgContext, applicationId: string, folderId: string) {
	const folder = await folderRepo.findFolder(ctx.organization.id, folderId);
	if (!folder || folder.applicationId !== applicationId || folder.ownerAppUserId) throw notFound('Dossier introuvable.');
	return folder;
}

/** Ancestors of a folder, root first. The tree is shallow in practice: one query per level. */
async function crumbsOf(ctx: OrgContext, parentId: string | null): Promise<FolderCrumb[]> {
	const crumbs: FolderCrumb[] = [];
	for (let id = parentId; id; ) {
		const f = await folderRepo.findFolder(ctx.organization.id, id);
		if (!f) break;
		crumbs.unshift({ id: f.id, name: f.name });
		id = f.parentId;
	}
	return crumbs;
}

export async function browse(
	ctx: OrgContext,
	applicationId: string,
	folderId: string | null
): Promise<FolderBrowser> {
	assertCan(ctx, 'read');
	const application = await applicationOrThrow(ctx, applicationId);
	const folder = folderId ? await folderOrThrow(ctx, applicationId, folderId) : null;
	const [crumbs, children] = await Promise.all([
		folder ? crumbsOf(ctx, folder.parentId) : Promise.resolve([]),
		folderRepo.listChildren(ctx.organization.id, applicationId, folder?.id ?? null)
	]);
	return {
		application,
		folder: folder ? { id: folder.id, name: folder.name, visibility: folder.visibility } : null,
		crumbs,
		folders: children.map((c) => ({
			id: c.id,
			name: c.name,
			visibility: c.visibility,
			folderCount: c._count.children
		})),
		canWrite: can(ctx.organization.role, ctx.isSuperadmin, 'files.write'),
		storageEnabled: ctx.organization.storageEnabled
	};
}

async function assertNameFree(
	ctx: OrgContext,
	applicationId: string,
	parentId: string | null,
	name: string,
	excludeId?: string
) {
	if (await folderRepo.nameTaken(ctx.organization.id, applicationId, parentId, name, excludeId)) {
		throw new HubError('Un dossier porte déjà ce nom ici.', { field: 'name' });
	}
}

export async function createFolder(
	ctx: OrgContext,
	applicationId: string,
	input: { name: string; parentId?: string; visibility?: Visibility }
): Promise<string> {
	assertCan(ctx, 'files.write');
	assertStorageEnabled(ctx);
	await applicationOrThrow(ctx, applicationId);
	const parent = input.parentId ? await folderOrThrow(ctx, applicationId, input.parentId) : null;
	// A subfolder inherits its parent's visibility; a root folder must choose one.
	const visibility = parent?.visibility ?? input.visibility;
	if (!visibility) throw new HubError('Visibilité requise.', { field: 'visibility' });
	await assertNameFree(ctx, applicationId, parent?.id ?? null, input.name);
	const folder = await folderRepo.createFolder({
		organizationId: ctx.organization.id,
		applicationId,
		parentId: parent?.id ?? null,
		name: input.name,
		visibility
	});
	return folder.name;
}

export async function renameFolder(
	ctx: OrgContext,
	applicationId: string,
	folderId: string,
	name: string
): Promise<string> {
	assertCan(ctx, 'files.write');
	assertStorageEnabled(ctx);
	const folder = await folderOrThrow(ctx, applicationId, folderId);
	await assertNameFree(ctx, applicationId, folder.parentId, name, folder.id);
	await folderRepo.renameFolder(ctx.organization.id, folder.id, name);
	return name;
}

/** Delete a folder, its whole subtree and every file in it — the stored objects first, then the
 *  rows (folders and files cascade), which frees their bytes at once (§10). */
export async function deleteFolder(ctx: OrgContext, applicationId: string, folderId: string): Promise<void> {
	assertCan(ctx, 'files.write');
	assertStorageEnabled(ctx);
	const folder = await folderOrThrow(ctx, applicationId, folderId);
	const folderIds = await folderRepo.listSubtreeIds(ctx.organization.id, folder.id);
	const siteFiles = await fileRepo.countSiteFilesInFolders(ctx.organization.id, folderIds);
	if (siteFiles) {
		throw new HubError(
			`Ce dossier contient ${siteFiles} fichier${siteFiles > 1 ? 's' : ''} envoyé${siteFiles > 1 ? 's' : ''} par le site : ` +
				'ils se suppriment depuis le site uniquement.',
			{ status: 403 }
		);
	}
	const pinned = await fileRepo.countPinnedFilesInFolders(ctx.organization.id, folderIds);
	if (pinned) {
		throw new HubError(
			`Ce dossier contient ${pinned} fichier${pinned > 1 ? 's' : ''} utilisé${pinned > 1 ? 's' : ''} par le site : ` +
				"il doit d'abord les libérer.",
			{ status: 409 }
		);
	}
	await purgeObjects(await fileRepo.listFilesInFolders(ctx.organization.id, folderIds));
	await folderRepo.deleteFolder(ctx.organization.id, folder.id);
}
