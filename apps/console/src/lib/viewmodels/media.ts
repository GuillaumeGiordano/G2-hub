import type { FileKind } from '$lib/records/files';
import type { Visibility } from '$lib/records/storage';

/** One READY file with everything the Files tab's viewer needs. */
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
	/** The site's pins (« product:42 »…): while one exists the file cannot be deleted (§23). */
	pins: string[];
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
