import { z } from 'zod';
import { email, requiredString } from '$lib/validation';

// Member forms (superadmin, §32) — shared by the server action and the browser (`FieldErrors`). No role:
// every member is an Admin (DECISIONS.md §26).

export const memberAddSchema = z.object({
	name: requiredString('Nom requis'),
	email: email()
});

/** The console's « Membres »: an account and the organizations it is an Admin of (the ids are posted
 *  as one field each, read with `formData.getAll`). */
export const accountCreateSchema = z.object({
	name: requiredString('Nom requis').max(120, '120 caractères maximum'),
	email: email(),
	organizationIds: z.array(z.string().min(1)).min(1, 'Choisissez au moins une organisation')
});

export const accountOrganizationsSchema = z.object({
	userId: requiredString(),
	organizationIds: z.array(z.string().min(1)).min(1, 'Choisissez au moins une organisation')
});

export const accountUpdateSchema = z.object({
	userId: requiredString(),
	name: requiredString('Nom requis').max(120, '120 caractères maximum'),
	email: email()
});

/** Edit a member's account (name and sign-in e-mail). */
export const memberUpdateSchema = z.object({
	membershipId: requiredString(),
	name: requiredString('Nom requis').max(120, '120 caractères maximum'),
	email: email()
});
