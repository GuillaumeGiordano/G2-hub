import { z } from 'zod';
import { isQuotaTier } from '$lib/records/organization';
import { MAX_APP_USERS_LIMIT } from '$lib/records/appUsers';

// Bodies of the internal API (G2 WebDev portal) — DECISIONS.md §27.

/** PATCH /api/internal/v1/organizations/:id — the plan: a storage tier and / or the offers (§12). */
export const internalPlanSchema = z
	.object({
		quotaBytes: z
			.number('quotaBytes invalide')
			.int('quotaBytes invalide')
			.refine(isQuotaTier, 'quotaBytes : un palier (1, 5 ou 20 Go en octets)')
			.optional(),
		authEnabled: z.boolean('authEnabled invalide').optional(),
		storageEnabled: z.boolean('storageEnabled invalide').optional(),
		maxAppUsers: z
			.number('maxAppUsers invalide')
			.int('maxAppUsers invalide')
			.min(1, 'maxAppUsers : au moins 1')
			.max(MAX_APP_USERS_LIMIT, `maxAppUsers : ${MAX_APP_USERS_LIMIT} au plus`)
			.optional()
	})
	.strict()
	.refine(
		(b) => Object.values(b).some((v) => v !== undefined),
		'Rien à modifier.'
	);
