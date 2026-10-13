import { z } from 'zod';
import { requiredString } from '$lib/validation';
import { API_KEY_KINDS } from '$lib/records/apiKeys';

// API key form (owner) — shared by the server action and the browser (`FieldErrors`).
export const apiKeyCreateSchema = z.object({
	name: requiredString('Nom de la clé requis').max(80, '80 caractères maximum'),
	kind: z.enum(API_KEY_KINDS, 'Type de clé requis')
});
