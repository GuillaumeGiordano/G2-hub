import type { Visibility } from '$lib/records/storage';
import { IMAGE_WIDTHS } from './images';
import { deleteObjects } from './s3';

/** A processed version as stored on a file row (`StoredFile.variants`). */
export type StoredVariant = {
	name: string;
	key: string;
	contentType: string;
	bytes: number;
	width?: number;
	height?: number;
};

/** Every key a file's processing may write under its prefix — used to clean up after a failure,
 *  when some versions were stored before the error. */
export function possibleKeys(storagePrefix: string): string[] {
	return [...Object.keys(IMAGE_WIDTHS).map((n) => `${storagePrefix}${n}.webp`), `${storagePrefix}document.pdf`];
}

/** Delete the stored objects of files: their processed versions + any leftover original. */
export async function purgeObjects(
	files: { visibility: Visibility; originalKey: string | null; variants: unknown }[]
): Promise<void> {
	for (const visibility of ['PUBLIC', 'PRIVATE'] as const) {
		const keys = files
			.filter((f) => f.visibility === visibility)
			.flatMap((f) => (f.variants as StoredVariant[]).map((v) => v.key));
		await deleteObjects(visibility, keys);
	}
	await deleteObjects('PRIVATE', files.flatMap((f) => (f.originalKey ? [f.originalKey] : [])));
}
