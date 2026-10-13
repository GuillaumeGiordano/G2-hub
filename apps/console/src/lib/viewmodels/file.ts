import type { FileKind, FileStatus } from '$lib/records/files';

/** A file in the browser list. */
export type FileListItem = {
	id: string;
	name: string;
	kind: FileKind;
	status: FileStatus;
	/** Stored bytes (processed versions), or the reserved size while uploading / processing. */
	bytes: number;
	width: number | null;
	height: number | null;
	error: string | null;
	createdAt: Date;
	/** Thumbnail to show in the list (public URL, or a short-lived signed link for a private file). */
	thumbUrl: string | null;
	/** Full version to open (largest image, the PDF…). */
	viewUrl: string | null;
	/** Stable public URL to copy into a site — public files only. */
	publicUrl: string | null;
};

/** Storage consumption of the organization (DECISIONS.md §10). */
export type StorageUsage = { usedBytes: number; quotaBytes: number };

/** Answer to an upload request: where the browser PUTs the original. */
export type UploadTicket = { fileId: string; uploadUrl: string; contentType: string };
