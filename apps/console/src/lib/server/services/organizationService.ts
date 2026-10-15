import { prisma } from '$lib/server/db';
import * as orgRepo from '$lib/server/repositories/organizationRepository';
import * as membershipRepo from '$lib/server/repositories/membershipRepository';
import * as sessionRepo from '$lib/server/repositories/sessionRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import * as userRepo from '$lib/server/repositories/userRepository';
import { purgeObjects } from '$lib/server/storage/purge';
import { toActiveOrganization, toOrganizationListItem } from '$lib/server/mappers/organizationMapper';
import { ensureAccount, sendInvitation } from './accountService';
import { forbidden, notFound } from '$lib/server/errors';
import { slugify } from '$lib/utils/slug';
import type { OrgRole } from '$lib/records/organization';
import type {
	ActiveOrganization,
	CreatedOrganization,
	OrganizationListItem
} from '$lib/viewmodels/organization';

// Organizations: listing (scoped), lifecycle (superadmin only) and the active organization of a
// session. Isolation rule: a member only ever sees the organizations it belongs to; only the
// superadmin sees and manages them all (DECISIONS.md §13).

type Actor = { id: string; isSuperadmin: boolean };

export async function listOrganizations(
	actor: Actor,
	params: { search?: string; page: number; perPage: number }
): Promise<{ items: OrganizationListItem[]; total: number }> {
	const visibleTo = actor.isSuperadmin ? null : actor.id;
	const [rows, total] = await Promise.all([
		orgRepo.searchOrganizations({
			search: params.search,
			visibleTo,
			userId: actor.id,
			skip: (params.page - 1) * params.perPage,
			take: params.perPage
		}),
		orgRepo.countOrganizations(params.search, visibleTo)
	]);
	const used = await fileRepo.usedBytesByOrganization(rows.map((r) => r.id));
	return { items: rows.map((r) => toOrganizationListItem(r, used.get(r.id) ?? 0n)), total };
}

/** A free slug derived from the name: "boulangerie", then "boulangerie-2", "-3"… */
async function freeSlug(name: string): Promise<string> {
	const base = slugify(name) || 'organisation';
	let slug = base;
	for (let n = 2; await orgRepo.slugTaken(slug); n++) slug = `${base}-${n}`;
	return slug;
}

/** Create an organization and its first owner — superadmin only. A new owner account is invited by
 *  e-mail; if the e-mail cannot be sent, nothing is kept (organization and account removed). */
export async function createOrganization(
	actor: Actor,
	input: { name: string; quotaBytes: number; storageEnabled: boolean; ownerName: string; ownerEmail: string }
): Promise<CreatedOrganization> {
	if (!actor.isSuperadmin) throw forbidden();
	const slug = await freeSlug(input.name);
	const ownerEmail = input.ownerEmail.trim().toLowerCase();
	const { org, owner } = await prisma.$transaction(async (tx) => {
		const org = await orgRepo.createOrganization(tx, {
			name: input.name,
			slug,
			quotaBytes: BigInt(input.quotaBytes),
			storageEnabled: input.storageEnabled
		});
		const owner = await ensureAccount({ name: input.ownerName, email: ownerEmail }, tx);
		await membershipRepo.createMembership({ organizationId: org.id, userId: owner.userId, role: 'OWNER' }, tx);
		return { org, owner };
	});
	if (owner.created) {
		try {
			await sendInvitation({ userId: owner.userId, name: input.ownerName.trim(), email: ownerEmail }, org.name);
		} catch (err) {
			await orgRepo.deleteOrganization(org.id);
			await userRepo.deleteUser(owner.userId);
			throw err;
		}
	}
	return { name: org.name, ownerEmail, invited: owner.created };
}

export async function updateOrganization(
	actor: Actor,
	id: string,
	input: { name: string; quotaBytes: number; storageEnabled: boolean }
): Promise<string> {
	if (!actor.isSuperadmin) throw forbidden();
	if (!(await orgRepo.findOrganizationById(id))) throw notFound('Organisation introuvable.');
	const org = await orgRepo.updateOrganization(id, {
		name: input.name,
		quotaBytes: BigInt(input.quotaBytes),
		storageEnabled: input.storageEnabled
	});
	return org.name;
}

/** Delete an organization — superadmin only: its stored objects first, then the row (memberships,
 *  applications, folders and files cascade). Its members keep their account: they may belong to
 *  other organizations. */
export async function deleteOrganization(actor: Actor, id: string): Promise<string> {
	if (!actor.isSuperadmin) throw forbidden();
	if (!(await orgRepo.findOrganizationById(id))) throw notFound('Organisation introuvable.');
	await purgeObjects(await fileRepo.listFilesForPurge(id));
	const org = await orgRepo.deleteOrganization(id);
	return org.name;
}

// ─── Active organization (stored on the session) ────────────────────────────

/** The memberships of a user (role per organization) — used by the hook. */
export function membershipsOf(userId: string) {
	return membershipRepo.findMembershipsOfUser(userId);
}

/**
 * Resolve the organization a session works in. The stored id is re-checked on every request
 * (membership revoked, organization deleted…). A member of exactly one organization gets it
 * selected automatically.
 */
export async function resolveActiveOrganization(
	session: { id: string; activeOrganizationId?: string | null },
	actor: Actor,
	memberships: { organizationId: string; role: OrgRole }[]
): Promise<ActiveOrganization | null> {
	let orgId = session.activeOrganizationId ?? null;
	let role: OrgRole | null = memberships.find((m) => m.organizationId === orgId)?.role ?? null;

	if (orgId && !role && !actor.isSuperadmin) orgId = null; // no longer a member
	if (!orgId && memberships.length === 1) {
		orgId = memberships[0].organizationId;
		role = memberships[0].role;
	}

	const org = orgId ? await orgRepo.findOrganizationById(orgId) : null;
	const resolvedId = org?.id ?? null;
	if (resolvedId !== (session.activeOrganizationId ?? null)) {
		await sessionRepo.setActiveOrganization(session.id, resolvedId);
	}
	return org ? toActiveOrganization(org, role) : null;
}

/** Switch the session to `organizationId` — only to an organization the actor may see. */
export async function switchOrganization(sessionId: string, actor: Actor, organizationId: string): Promise<string> {
	const org = await orgRepo.findOrganizationById(organizationId);
	const member = org ? await membershipRepo.findMembership(organizationId, actor.id) : null;
	// 404, not 403: never reveal that an organization exists elsewhere (DECISIONS.md §13).
	if (!org || (!member && !actor.isSuperadmin)) throw notFound('Organisation introuvable.');
	await sessionRepo.setActiveOrganization(sessionId, org.id);
	return org.name;
}
