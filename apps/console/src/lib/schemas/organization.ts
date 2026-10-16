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
	authEnabled: checkbox(),
	storageEnabled: checkbox()
};

/** At least one offer: without any, its Admins cannot open the organization (§12). */
const withAnOffer = (b: { authEnabled: boolean; storageEnabled: boolean }) => b.authEnabled || b.storageEnabled;
const OFFER_REQUIRED = { message: 'Choisissez au moins une offre', path: ['authEnabled'] };

/** Creation: the organization and its first owner. */
export const organizationCreateSchema = z
	.object({
		...organizationFields,
		ownerName: requiredString('Nom de l’admin requis'),
		ownerEmail: email()
	})
	.refine(withAnOffer, OFFER_REQUIRED);

export const organizationUpdateSchema = z
	.object({ ...organizationFields, id: requiredString() })
	.refine(withAnOffer, OFFER_REQUIRED);
