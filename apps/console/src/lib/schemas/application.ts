import { z } from 'zod';
import { jsonField, requiredString } from '$lib/validation';

// Application forms (owner) — shared by the server actions and the browser (`FieldErrors`).

/** An origin is scheme + host (+ port), nothing else: "https://monsite.fr", "http://localhost:5173". */
function isOrigin(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
	} catch {
		return false;
	}
}

const origin = z
	.string()
	.trim()
	.transform((v) => v.replace(/\/+$/, ''))
	.refine(isOrigin, 'Origine invalide : https://domaine.fr (sans chemin)');

const applicationFields = {
	name: requiredString("Nom de l'application requis"),
	// The TagInput posts its list as JSON in a hidden `origins` field.
	origins: jsonField(z.array(origin, 'Origines illisibles').max(20, '20 origines maximum'))
};

export const applicationSchema = z.object(applicationFields);

export const applicationUpdateSchema = applicationSchema.extend({ id: requiredString() });
