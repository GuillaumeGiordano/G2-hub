// File presentation config + upload rules (client-safe): the browser checks them before uploading,
// the server enforces them again (DECISIONS.md §5, §10).

export const FILE_KINDS = ['IMAGE', 'VIDEO', 'PDF'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const FILE_STATUSES = ['UPLOADING', 'PROCESSING', 'READY', 'FAILED'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

const MB = 1024 ** 2;

/** Largest file accepted per kind: 20 MB image / PDF, 200 MB video (§5). */
export const MAX_BYTES: Record<FileKind, number> = {
	IMAGE: 20 * MB,
	VIDEO: 200 * MB,
	PDF: 20 * MB
};

/** Accepted types → kind. HEIC (iPhone photos) is not decodable server-side: export as JPEG.
 *  Videos are accepted from step 2c (transcoding). */
export const ACCEPTED_TYPES: Record<string, FileKind> = {
	'image/jpeg': 'IMAGE',
	'image/png': 'IMAGE',
	'image/webp': 'IMAGE',
	'image/gif': 'IMAGE',
	'image/avif': 'IMAGE',
	'application/pdf': 'PDF'
};

/** The `accept` attribute of the file picker. */
export const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_TYPES).join(',');

export function kindOf(contentType: string): FileKind | null {
	return ACCEPTED_TYPES[contentType] ?? null;
}

export const fileKindLabel: Record<FileKind, string> = {
	IMAGE: 'Image',
	VIDEO: 'Vidéo',
	PDF: 'PDF'
};

export const fileStatusLabel: Record<FileStatus, string> = {
	UPLOADING: 'Envoi…',
	PROCESSING: 'Traitement…',
	READY: 'Prêt',
	FAILED: 'Échec'
};

export const fileStatusVariant: Record<FileStatus, 'default' | 'info' | 'success' | 'danger'> = {
	UPLOADING: 'info',
	PROCESSING: 'info',
	READY: 'success',
	FAILED: 'danger'
};

/** Why a file cannot be uploaded (type / size), or null when it may. */
export function uploadRefusal(file: { type: string; size: number }): string | null {
	const kind = kindOf(file.type);
	if (!kind) return 'Type non accepté (images JPEG, PNG, WebP, GIF, AVIF ou PDF).';
	if (file.size <= 0) return 'Fichier vide.';
	if (file.size > MAX_BYTES[kind]) return `Trop volumineux : ${MAX_BYTES[kind] / MB} Mo maximum.`;
	return null;
}
