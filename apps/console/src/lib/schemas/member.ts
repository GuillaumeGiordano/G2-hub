import { z } from 'zod';
import { email, requiredString } from '$lib/validation';

// Member forms (superadmin, §32) — shared by the server action and the browser (`FieldErrors`). No role:
// every member is an Admin (DECISIONS.md §26).

export const memberAddSchema = z.object({
	name: requiredString('Nom requis'),
	email: email()
});

/** Edit a member's account (name and sign-in e-mail). */
export const memberUpdateSchema = z.object({
	membershipId: requiredString(),
	name: requiredString('Nom requis').max(120, '120 caractères maximum'),
	email: email()
});
