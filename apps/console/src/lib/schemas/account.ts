import { z } from 'zod';
import { email, requiredString } from '$lib/validation';

// Console accounts' « mot de passe oublié » — shared by the server actions and the browser.

/** Same bounds as Better Auth's (auth.ts `minPasswordLength`, its default maximum). */
export const CONSOLE_PASSWORD_MIN_LENGTH = 8;
const CONSOLE_PASSWORD_MAX_LENGTH = 128;

export const consolePasswordForgotSchema = z.object({ email: email() });

export const consolePasswordResetSchema = z
	.object({
		token: requiredString('Lien invalide'),
		password: z
			.string()
			.min(CONSOLE_PASSWORD_MIN_LENGTH, `${CONSOLE_PASSWORD_MIN_LENGTH} caractères minimum`)
			.max(CONSOLE_PASSWORD_MAX_LENGTH, `${CONSOLE_PASSWORD_MAX_LENGTH} caractères maximum`),
		confirm: z.string()
	})
	.refine((v) => v.password === v.confirm, { message: 'Les deux mots de passe diffèrent', path: ['confirm'] });
