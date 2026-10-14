import { z } from 'zod';
import { email, requiredString } from '$lib/validation';

// Member form (Admin) — shared by the server action and the browser (`FieldErrors`). No role:
// every member is an Admin (DECISIONS.md §26).

export const memberAddSchema = z.object({
	name: requiredString('Nom requis'),
	email: email()
});
