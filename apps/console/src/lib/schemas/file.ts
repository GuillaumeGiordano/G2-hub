import { z } from 'zod';
import { requiredString } from '$lib/validation';

// Upload request (JSON, from the console's uploader) — type / size rules are enforced by the service.
export const uploadRequestSchema = z.object({
	folderId: requiredString(),
	name: requiredString('Nom de fichier requis').max(200, '200 caractères maximum'),
	size: z.number('Taille invalide').int('Taille invalide').positive('Fichier vide'),
	contentType: requiredString('Type requis')
});
