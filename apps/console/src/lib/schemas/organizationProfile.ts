import { z } from 'zod';
import { checkbox, optionalEmail, optionalString } from '$lib/validation';
import { LEGAL_FORMS, ORGANIZATION_STATUSES } from '$lib/records/organization';
import { digitsOnly, isValidSiret, isValidVat, normalizeNaf, normalizeVat } from '$lib/utils/companyIds';

// « Mon organisation » forms (DECISIONS.md §31) — shared by the server actions and the browser.
// Every field is optional for now: an empty field is stored as null.

/** Optional text, at most `max` characters. */
const text = (max = 200) =>
	optionalString().refine((v) => v === undefined || v.length <= max, `${max} caractères maximum`);

const optionalSiret = () =>
	optionalString()
		.refine((v) => v === undefined || isValidSiret(v), 'SIRET invalide (14 chiffres, clé de contrôle)')
		.transform((v) => (v ? digitsOnly(v) : undefined));

const optionalVat = () =>
	optionalString()
		.refine((v) => v === undefined || isValidVat(v), 'N° de TVA invalide (ex. FR12345678901)')
		.transform((v) => (v ? normalizeVat(v) : undefined));

const optionalNaf = () =>
	optionalString()
		.refine((v) => v === undefined || normalizeNaf(v) !== null, 'Code NAF invalide (ex. 62.01Z)')
		.transform((v) => (v ? (normalizeNaf(v) ?? undefined) : undefined));

const optionalUrl = () =>
	optionalString()
		.transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
		.refine((v) => v === undefined || z.url().safeParse(v).success, 'Adresse de site invalide');

const optionalLegalForm = () =>
	optionalString().refine((v) => v === undefined || (LEGAL_FORMS as readonly string[]).includes(v), 'Forme juridique invalide');

/** What the organization's Admins fill in. */
export const organizationProfileSchema = z.object({
	name: z.string().trim().min(1, "Nom de l'organisation requis").max(120, '120 caractères maximum'),
	legalName: text(),
	legalForm: optionalLegalForm(),
	siret: optionalSiret(),
	vatNumber: optionalVat(),
	nafCode: optionalNaf(),
	email: optionalEmail(),
	phone: text(30),
	website: optionalUrl(),
	addressLine1: text(),
	addressLine2: text(),
	postalCode: text(10),
	city: text(100),
	country: text(60),
	billingSameAddress: checkbox(),
	billingAddressLine1: text(),
	billingAddressLine2: text(),
	billingPostalCode: text(10),
	billingCity: text(100),
	billingCountry: text(60),
	billingEmail: optionalEmail(),
	billingContactName: text(120),
	purchaseOrderRef: text(60),
	contactName: text(120),
	contactRole: text(80),
	contactEmail: optionalEmail(),
	contactPhone: text(30),
	dpoName: text(120),
	dpoEmail: optionalEmail()
});

export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

/** The contract part: superadmin only. */
export const organizationContractSchema = z.object({
	status: z.enum(ORGANIZATION_STATUSES, 'Statut invalide'),
	contractStartedAt: optionalString().refine(
		(v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
		'Date invalide'
	),
	internalNotes: text(5000)
});

export type OrganizationContractInput = z.infer<typeof organizationContractSchema>;
