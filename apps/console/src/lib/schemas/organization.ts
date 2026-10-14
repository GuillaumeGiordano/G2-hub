import { z } from 'zod';
import { checkbox, email, requiredString } from '$lib/validation';
import { QUOTA_TIERS } from '$lib/records/organization';

// Organization forms (superadmin) — shared by the server actions and the browser (`FieldErrors`).

const quota = z
	.string('Forfait requis')
	.refine((v) => (QUOTA_TIERS as readonly number[]).includes(Number(v)), 'Forfait invalide')
	.transform((v) => Number(v));

const organizationFields = {
	name: requiredString("Nom de l'organisation requis"),
	quotaBytes: quota,
	storageEnabled: checkbox()
};

/** Creation: the organization and its first owner. */
export const organizationCreateSchema = z.object({
	...organizationFields,
	ownerName: requiredString('Nom de l’admin requis'),
	ownerEmail: email()
});

export const organizationUpdateSchema = z.object({ ...organizationFields, id: requiredString() });
