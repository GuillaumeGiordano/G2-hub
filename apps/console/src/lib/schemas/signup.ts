import { z } from 'zod';
import { checkbox, email, requiredString } from '$lib/validation';

// Public sign-up of a console account (DECISIONS.md §45) — shared by the server action and the
// browser. No password here: it is chosen from the e-mailed link, once the address is proven.

export const signupSchema = z.object({
	name: requiredString('Votre nom est requis').max(100, '100 caractères maximum'),
	email: email(),
	privacy: checkbox().refine((v) => v, 'Acceptez la politique de confidentialité pour continuer')
});
