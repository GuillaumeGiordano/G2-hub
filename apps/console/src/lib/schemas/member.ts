import { z } from 'zod';
import { email, requiredString } from '$lib/validation';
import { ORG_ROLES } from '$lib/records/organization';

// Member forms (owner) — shared by the server actions and the browser (`FieldErrors`).

const role = z.enum(ORG_ROLES, 'Rôle requis');

export const memberAddSchema = z.object({
	name: requiredString('Nom requis'),
	email: email(),
	role
});

export const memberRoleSchema = z.object({ membershipId: requiredString(), role });
