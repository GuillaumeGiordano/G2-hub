import { z } from 'zod';
import { ORGANIZATION_STATUSES } from '$lib/records/organization';

// « Mon organisation » forms — shared by the server actions and the browser. The legal and billing
// profile lives in g2-erp (DECISIONS.md §31): the hub keeps the name, the logo and the status.

/** What the organization's Admins edit. */
export const organizationProfileSchema = z.object({
	name: z.string().trim().min(1, "Nom de l'organisation requis").max(120, '120 caractères maximum')
});

export type OrganizationProfileInput = z.infer<typeof organizationProfileSchema>;

/** The status: superadmin only. */
export const organizationStatusSchema = z.object({
	status: z.enum(ORGANIZATION_STATUSES, 'Statut invalide')
});

export type OrganizationStatusInput = z.infer<typeof organizationStatusSchema>;
