import { z } from 'zod';
import { requiredString } from '$lib/validation';
import { APP_USER_ROLES, DEFAULT_APP_USER_ROLE, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '$lib/records/appUsers';

// Application users (portal end users) — shared by the server actions / API and the browser.

/** An address as typed or sent by an API caller: trimmed and lowercased, then checked. */
const accountEmail = () =>
	z
		.string('Adresse e-mail requise')
		.trim()
		.toLowerCase()
		.max(254, 'Adresse trop longue')
		.pipe(z.email('Adresse e-mail invalide'));

const role = z.enum(APP_USER_ROLES, 'Rôle invalide');

/** Invite someone to an application's portal (console or API). The role defaults to USER. */
export const appUserInviteSchema = z.object({
	name: requiredString('Nom requis').max(120, '120 caractères maximum'),
	email: accountEmail(),
	role: role.default(DEFAULT_APP_USER_ROLE)
});

/** Change the role of an application user (console). */
export const appUserRoleSchema = z.object({ id: requiredString(), role });

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
