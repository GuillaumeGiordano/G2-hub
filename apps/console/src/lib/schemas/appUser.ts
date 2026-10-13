import { z } from 'zod';
import { requiredString } from '$lib/validation';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '$lib/records/appUsers';

// Application users (portal end users) — shared by the server actions / API and the browser.

/** An address as typed or sent by an API caller: trimmed and lowercased, then checked. */
const accountEmail = () =>
	z
		.string('Adresse e-mail requise')
		.trim()
		.toLowerCase()
		.max(254, 'Adresse trop longue')
		.pipe(z.email('Adresse e-mail invalide'));

/** Invite someone to an application's portal (console or API). */
export const appUserInviteSchema = z.object({
	name: requiredString('Nom requis').max(120, '120 caractères maximum'),
	email: accountEmail()
});

/** The « choose a password » page (invitation or reset link). */
export const passwordChooseSchema = z
	.object({
		password: z
			.string()
			.min(PASSWORD_MIN_LENGTH, `${PASSWORD_MIN_LENGTH} caractères minimum`)
			.max(PASSWORD_MAX_LENGTH, `${PASSWORD_MAX_LENGTH} caractères maximum`),
		confirm: z.string()
	})
	.refine((v) => v.password === v.confirm, { message: 'Les deux mots de passe diffèrent', path: ['confirm'] });

/** « Mot de passe oublié ». */
export const passwordForgotSchema = z.object({ email: accountEmail() });
