import { z } from 'zod';
import { optionalString, requiredString } from '$lib/validation';
import { FOLDER_NAME_MAX, VISIBILITIES } from '$lib/records/storage';

// Folder forms — shared by the server actions and the browser (`FieldErrors`).

/** A folder name: trimmed, no slash (paths are built from the tree, not typed). */
const folderName = requiredString('Nom du dossier requis')
	.max(FOLDER_NAME_MAX, `${FOLDER_NAME_MAX} caractères maximum`)
	.refine((v) => !/[/\\]/.test(v), 'Le nom ne peut pas contenir / ni \\');

/** Creation. `parentId` empty = a root folder, which picks its visibility; a subfolder inherits
 *  its parent's (the field is then ignored by the service). */
export const folderCreateSchema = z.object({
	name: folderName,
	parentId: optionalString(),
	visibility: z.enum(VISIBILITIES, 'Visibilité requise').optional()
});

export const folderRenameSchema = z.object({ id: requiredString(), name: folderName });
