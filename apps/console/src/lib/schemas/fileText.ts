import { z } from 'zod';
import { optionalString, requiredString } from '$lib/validation';

// Media library: edit a file's alternative text and caption — shared by the action and the browser.
export const fileTextSchema = z.object({
	id: requiredString(),
	alt: optionalString().refine((v) => !v || v.length <= 300, '300 caractères maximum'),
	caption: optionalString().refine((v) => !v || v.length <= 500, '500 caractères maximum')
});
