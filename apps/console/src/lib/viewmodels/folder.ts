import type { FolderLock, Visibility } from '$lib/records/storage';
import type { PlatformAccess } from '$lib/records/platform';

/** A folder in the browser list. */
export type FolderListItem = {
	id: string;
	name: string;
	visibility: Visibility;
	/** What an Admin may do with it (§37). */
	lock: FolderLock;
	/** Number of direct subfolders. */
	folderCount: number;
};

/** One step of the breadcrumb (application root first). */
export type FolderCrumb = { id: string; name: string };

/** What the file browser shows for one application and (optionally) one folder. */
export type FolderBrowser = {
	application: { id: string; name: string; platformAccess: PlatformAccess };
	/** null = the application's root. */
	folder: { id: string; name: string; visibility: Visibility; lock: FolderLock } | null;
	/** Ancestors of `folder`, root first (excluding `folder` itself). */
	crumbs: FolderCrumb[];
	folders: FolderListItem[];
	/** May create / rename / delete in this application (Admins). */
	canWrite: boolean;
	/** May lock / unlock folders (the superadmin, §37). */
	canManageLocks: boolean;
	/** May upload, delete files and create subfolders in the current folder (not read-only for an Admin). */
	canEditContent: boolean;
	/** The organization subscribed to the storage option (« Accès + Stockage »). */
	storageEnabled: boolean;
};
