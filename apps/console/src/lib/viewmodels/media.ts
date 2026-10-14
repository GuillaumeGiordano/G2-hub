import type { FileKind } from '$lib/records/files';
import type { Visibility } from '$lib/records/storage';

/** One media of the library (a READY file) with everything the grid and the viewer need. */
export type MediaItem = {
	id: string;
	name: string;
	kind: FileKind;
	width: number | null;
	height: number | null;
	bytes: number;
	createdAt: Date;
	folderId: string;
	folderName: string;
	visibility: Visibility;
	/** CONSOLE, or API = uploaded by the client site: deleted from the site only (§22). */
	source: 'CONSOLE' | 'API';
	alt: string | null;
	caption: string | null;
	/** Grid tile: image thumbnail or video poster (null for a PDF). */
	thumbUrl: string | null;
	/** Viewer: largest image, the video, the PDF. */
	viewUrl: string;
	/** Video poster shown before playback. */
	posterUrl: string | null;
	/** Forces a download under the file's name (signed, 5 min). */
	downloadUrl: string;
	/** Stable public URL to paste into a site — public files only. */
	publicUrl: string | null;
};

/** A folder of the filter, labelled with its full path ("Galerie / 2026"). */
export type MediaFolderOption = { value: string; label: string };

export type MediaLibrary = {
	application: { id: string; name: string };
	items: MediaItem[];
	total: number;
	page: number;
	perPage: number;
	folders: MediaFolderOption[];
	/** May delete media (Admins). */
	canWrite: boolean;
	storageEnabled: boolean;
};
