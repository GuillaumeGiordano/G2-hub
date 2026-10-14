import type { Visibility } from '$lib/records/storage';

/** A folder in the browser list. */
export type FolderListItem = {
	id: string;
	name: string;
	visibility: Visibility;
	/** Number of direct subfolders. */
	folderCount: number;
};

/** One step of the breadcrumb (application root first). */
export type FolderCrumb = { id: string; name: string };

/** What the file browser shows for one application and (optionally) one folder. */
export type FolderBrowser = {
	application: { id: string; name: string };
	/** null = the application's root. */
	folder: { id: string; name: string; visibility: Visibility } | null;
	/** Ancestors of `folder`, root first (excluding `folder` itself). */
	crumbs: FolderCrumb[];
	folders: FolderListItem[];
	/** May create / rename / delete in this application (Admins). */
	canWrite: boolean;
	/** The organization subscribed to the storage option (« Accès + Stockage »). */
	storageEnabled: boolean;
};
