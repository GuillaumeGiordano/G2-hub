import { z } from 'zod';
import { isQuotaTier } from '$lib/records/organization';

// Bodies of the internal API (G2 WebDev portal) — DECISIONS.md §27.

/** PATCH /api/internal/v1/organizations/:id — the plan: a storage tier and / or the storage option. */
export const internalPlanSchema = z
	.object({
		quotaBytes: z
			.number('quotaBytes invalide')
			.int('quotaBytes invalide')
			.refine(isQuotaTier, 'quotaBytes : un palier (1, 5 ou 20 Go en octets)')
			.optional(),
		storageEnabled: z.boolean('storageEnabled invalide').optional()
	})
	.strict()
	.refine((b) => b.quotaBytes !== undefined || b.storageEnabled !== undefined, 'Rien à modifier.');
