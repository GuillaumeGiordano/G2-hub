import { z } from 'zod';
import { DEFAULT_QUOTA_BYTES, isQuotaTier } from '$lib/records/organization';
import { MAX_APP_USERS_LIMIT } from '$lib/records/appUsers';

// Bodies of the internal API (G2 WebDev portal) — DECISIONS.md §27.

/** POST /api/internal/v1/organizations — an organization and its first Admin (§43). The plan is
 *  optional: the defaults of a new organization (1 GB, both offers). Both offers off is allowed: an
 *  organization opened at a prospect's first request, its offers come with the contract (§44). */
export const internalOrganizationCreateSchema = z
	.object({
		name: z.string('name requis').trim().min(1, 'name requis').max(120, 'name : 120 caractères au plus'),
		ownerName: z.string('ownerName requis').trim().min(1, 'ownerName requis').max(120, 'ownerName : 120 caractères au plus'),
		ownerEmail: z.email('ownerEmail invalide'),
		externalRef: z.string('externalRef invalide').trim().min(1).max(100, 'externalRef : 100 caractères au plus').optional(),
		quotaBytes: z
			.number('quotaBytes invalide')
			.int('quotaBytes invalide')
			.refine(isQuotaTier, 'quotaBytes : un palier (1, 5 ou 20 Go en octets)')
			.default(DEFAULT_QUOTA_BYTES),
		authEnabled: z.boolean('authEnabled invalide').default(true),
		storageEnabled: z.boolean('storageEnabled invalide').default(true),
		maxAppUsers: z
			.number('maxAppUsers invalide')
			.int('maxAppUsers invalide')
			.min(1, 'maxAppUsers : au moins 1')
			.max(MAX_APP_USERS_LIMIT, `maxAppUsers : ${MAX_APP_USERS_LIMIT} au plus`)
			.default(1000)
	})
	.strict();

/** PATCH /api/internal/v1/organizations/:id — the name (g2-erp is the master of the client's file,
 *  §44) and / or the plan: a storage tier, the offers (§12, both off allowed). */
export const internalPlanSchema = z
	.object({
		name: z.string('name invalide').trim().min(1, 'name requis').max(120, 'name : 120 caractères au plus').optional(),
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
