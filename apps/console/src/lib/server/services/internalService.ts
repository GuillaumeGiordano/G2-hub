import { Prisma } from '@g2-hub/db';
import * as orgRepo from '$lib/server/repositories/organizationRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import { HubError, notFound } from '$lib/server/errors';
import { formatBytes } from '$lib/records/organization';
import * as userRepo from '$lib/server/repositories/userRepository';
import { createOrganizationWithOwner } from './organizationService';
import { MEMBER_SUBJECT_PREFIX } from '$lib/records/sso';
import { internalOrganizationCreateSchema, internalPlanSchema } from '$lib/schemas/internal';
import { firstIssue } from '$lib/schemas/apiFile';

// Internal API for the G2 WebDev portal (DECISIONS.md §27): what it bills on, and the plan it
// changes after a payment. Instance-wide on purpose (the caller holds the instance token, checked in
// lib/server/internal/auth.ts) — never reachable with an API key or a console session.

/** An organization as the portal sees it. */
export type InternalOrganization = {
	id: string;
	name: string;
	slug: string;
	/** The two independent offers — §12. */
	authEnabled: boolean;
	storageEnabled: boolean;
	quotaBytes: number;
	usedBytes: number;
	members: number;
	applications: number;
	appUsers: number;
	/** The Auth offer's limit of application users (§39). */
	maxAppUsers: number;
	createdAt: string;
};

type BillingRow = NonNullable<Awaited<ReturnType<typeof orgRepo.findOrganizationForBilling>>>;

function toInternal(row: BillingRow, usedBytes: bigint): InternalOrganization {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		authEnabled: row.authEnabled,
		storageEnabled: row.storageEnabled,
		quotaBytes: Number(row.quotaBytes),
		usedBytes: Number(usedBytes),
		members: row._count.memberships,
		applications: row._count.applications,
		appUsers: row._count.appUsers,
		maxAppUsers: row.maxAppUsers,
		createdAt: row.createdAt.toISOString()
	};
}

/** GET /api/internal/v1/organizations */
export async function listOrganizations(): Promise<{ organizations: InternalOrganization[] }> {
	const rows = await orgRepo.listOrganizationsForBilling();
	const used = await fileRepo.usedBytesByOrganization(rows.map((r) => r.id));
	return { organizations: rows.map((r) => toInternal(r, used.get(r.id) ?? 0n)) };
}

/** GET /api/internal/v1/organizations/:id */
export async function getOrganization(id: string): Promise<InternalOrganization> {
	const row = await orgRepo.findOrganizationForBilling(id);
	if (!row) throw notFound('Organisation introuvable.');
	return toInternal(row, await fileRepo.usedBytes(id));
}

/** The Admin of a created organization: `sub` is what « Se connecter avec G2 Hub » will send. */
export type InternalOwner = { sub: string; email: string; invited: boolean };

/**
 * POST /api/internal/v1/organizations — g2-erp activates a client when its devis is won (§43): the
 * organization and its first Admin (a new account is invited, an existing one is attached). Same
 * `externalRef` again: the organization created the first time (`created: false`), nothing sent.
 */
export async function createOrganization(
	body: unknown
): Promise<{ created: boolean; organization: InternalOrganization; owner: InternalOwner | null }> {
	const parsed = internalOrganizationCreateSchema.safeParse(body);
	if (!parsed.success) throw new HubError(firstIssue(parsed.error));
	const input = parsed.data;
	const ownerEmail = input.ownerEmail.trim().toLowerCase();

	const alreadyCreated = async () => {
		const existing = input.externalRef ? await orgRepo.findOrganizationIdByExternalRef(input.externalRef) : null;
		if (!existing) return null;
		const account = await userRepo.findUserByEmail(ownerEmail);
		return {
			created: false,
			organization: await getOrganization(existing.id),
			owner: account ? { sub: MEMBER_SUBJECT_PREFIX + account.id, email: ownerEmail, invited: false } : null
		};
	};
	const existing = await alreadyCreated();
	if (existing) return existing;

	let org: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
	try {
		org = await createOrganizationWithOwner({ ...input, ownerEmail });
	} catch (err) {
		// Two calls with the same reference at once: the second one finds the first one's.
		const raced = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' ? await alreadyCreated() : null;
		if (raced) return raced;
		throw err;
	}
	return {
		created: true,
		organization: await getOrganization(org.id),
		owner: { sub: MEMBER_SUBJECT_PREFIX + org.ownerUserId, email: ownerEmail, invited: org.invited }
	};
}

/**
 * PATCH /api/internal/v1/organizations/:id — change the plan. A tier below what is already stored is
 * refused (409): it would silently block every upload; the client deletes files first (§10).
 */
export async function updatePlan(id: string, body: unknown): Promise<InternalOrganization> {
	const parsed = internalPlanSchema.safeParse(body);
	if (!parsed.success) throw new HubError(firstIssue(parsed.error));
	const current = await getOrganization(id);
	const { quotaBytes, authEnabled, storageEnabled, maxAppUsers } = parsed.data;
	if (quotaBytes !== undefined && quotaBytes < current.usedBytes) {
		throw new HubError(
			`L'organisation stocke déjà ${formatBytes(current.usedBytes)} : le palier ${formatBytes(quotaBytes)} est trop petit.`,
			{ status: 409 }
		);
	}
	await orgRepo.updatePlan(id, {
		...(quotaBytes !== undefined && { quotaBytes: BigInt(quotaBytes) }),
		...(authEnabled !== undefined && { authEnabled }),
		...(storageEnabled !== undefined && { storageEnabled }),
		...(maxAppUsers !== undefined && { maxAppUsers })
	});
	return getOrganization(id);
}
