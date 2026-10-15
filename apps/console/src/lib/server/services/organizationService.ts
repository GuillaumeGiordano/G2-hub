import { prisma } from '$lib/server/db';
import * as orgRepo from '$lib/server/repositories/organizationRepository';
import * as membershipRepo from '$lib/server/repositories/membershipRepository';
import * as sessionRepo from '$lib/server/repositories/sessionRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import * as userRepo from '$lib/server/repositories/userRepository';
import * as storage from '$lib/server/storage/s3';
import { processLogo } from '$lib/server/storage/images';
import { purgeObjects } from '$lib/server/storage/purge';
import { toActiveOrganization, toOrganizationContract, toOrganizationListItem, toOrganizationProfile } from '$lib/server/mappers/organizationMapper';
import { ensureAccount, sendInvitation } from './accountService';
import { assertCan, type OrgContext } from '$lib/server/context';
import { forbidden, HubError, notFound } from '$lib/server/errors';
import { can, LOGO_MAX_BYTES, LOGO_TYPES } from '$lib/records/organization';
import type { OrganizationContractInput, OrganizationProfileInput } from '$lib/schemas/organizationProfile';
import { slugify } from '$lib/utils/slug';
import type { OrgRole } from '$lib/records/organization';
import type {
	ActiveOrganization,
	CreatedOrganization,
	MyOrganization,
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
	const logoKey = (await orgRepo.findOrganizationProfile(id))?.logoKey;
	if (logoKey) await storage.deleteObjects('PUBLIC', [logoKey]);
	const org = await orgRepo.deleteOrganization(id);
	return org.name;
}

/** The organizations a member may switch to (« Choisir une organisation »). */
export function myOrganizations(actor: Actor) {
	return orgRepo.listOrganizationsOfUser(actor.id);
}

/** « Mon organisation »: the active organization's summary (every member). */
export async function getMyOrganization(ctx: OrgContext): Promise<MyOrganization> {
	assertCan(ctx, 'read');
	const org = ctx.organization;
	const [counts, used, memberships, profile] = await Promise.all([
		orgRepo.countsOf(org.id),
		fileRepo.usedBytesByOrganization([org.id]),
		membershipRepo.findMembershipsOfUser(ctx.userId),
		orgRepo.findOrganizationProfile(org.id)
	]);
	if (!profile) throw notFound('Organisation introuvable.');
	return {
		id: org.id,
		name: org.name,
		slug: org.slug,
		storageEnabled: org.storageEnabled,
		quotaBytes: org.quotaBytes,
		usedBytes: Number(used.get(org.id) ?? 0n),
		applicationCount: counts.applications,
		memberCount: counts.members,
		role: org.role,
		canSwitch: memberships.length > 1,
		canEdit: can(org.role, ctx.isSuperadmin, 'organization.manage'),
		isSuperadmin: ctx.isSuperadmin,
		logoUrl: profile.logoKey ? storage.publicUrl(profile.logoKey) : null,
		profile: toOrganizationProfile(profile),
		contract: toOrganizationContract(profile, ctx.isSuperadmin)
	};
}

/** Empty → null: an optional field cleared in the form is cleared in the database. */
const orNull = <T>(v: T | undefined) => (v === undefined ? null : v);

/** The profile, edited by the organization's Admins (and the superadmin). */
export async function updateOrganizationProfile(ctx: OrgContext, input: OrganizationProfileInput): Promise<string> {
	assertCan(ctx, 'organization.manage');
	const { name, billingSameAddress, ...rest } = input;
	const data = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, orNull(v)]));
	// « Same as the head office »: the billing address fields are not kept.
	if (billingSameAddress) {
		for (const k of ['billingAddressLine1', 'billingAddressLine2', 'billingPostalCode', 'billingCity', 'billingCountry']) data[k] = null;
	}
	const org = await orgRepo.updateOrganizationProfile(ctx.organization.id, { ...data, name, billingSameAddress });
	return org.name;
}

/** The contract (status, start date, internal notes): the superadmin's. */
export async function updateOrganizationContract(ctx: OrgContext, input: OrganizationContractInput): Promise<string> {
	if (!ctx.isSuperadmin) throw forbidden();
	const org = await orgRepo.updateOrganizationInternal(ctx.organization.id, {
		status: input.status,
		contractStartedAt: input.contractStartedAt ? new Date(`${input.contractStartedAt}T00:00:00Z`) : null,
		internalNotes: orNull(input.internalNotes)
	});
	return org.name;
}

/** Upload / replace the logo: resized to a small WebP in the PUBLIC bucket (any page may show it).
 *  It does not count toward the storage quota. */
export async function setOrganizationLogo(ctx: OrgContext, file: File): Promise<string> {
	assertCan(ctx, 'organization.manage');
	if (!LOGO_TYPES.includes(file.type)) throw new HubError('Format non accepté (JPEG, PNG ou WebP).', { field: 'logo' });
	if (file.size > LOGO_MAX_BYTES) throw new HubError('Logo trop lourd (2 Mo maximum).', { field: 'logo' });
	let body: Uint8Array;
	try {
		body = await processLogo(new Uint8Array(await file.arrayBuffer()));
	} catch {
		throw new HubError('Image illisible.', { field: 'logo' });
	}
	const previous = (await orgRepo.findOrganizationProfile(ctx.organization.id))?.logoKey ?? null;
	const key = `organizations/${ctx.organization.id}/logo-${crypto.randomUUID()}.webp`;
	await storage.putObject('PUBLIC', key, body, 'image/webp');
	await orgRepo.updateOrganizationInternal(ctx.organization.id, { logoKey: key });
	if (previous) await storage.deleteObjects('PUBLIC', [previous]);
	return storage.publicUrl(key);
}

export async function removeOrganizationLogo(ctx: OrgContext): Promise<void> {
	assertCan(ctx, 'organization.manage');
	const previous = (await orgRepo.findOrganizationProfile(ctx.organization.id))?.logoKey ?? null;
	if (!previous) return;
	await orgRepo.updateOrganizationInternal(ctx.organization.id, { logoKey: null });
	await storage.deleteObjects('PUBLIC', [previous]);
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

/**
 * The organization of an address (/o/<id>/…) if the actor may open it — a member, or the
 * superadmin — else null (the hook answers 404). It becomes the session's last opened organization
 * (the menu of the pages outside an organization, the redirects of the former addresses).
 */
export async function resolveOrganizationOfAddress(
	session: { id: string; activeOrganizationId?: string | null },
	actor: Actor,
	memberships: { organizationId: string; role: OrgRole }[],
	organizationId: string
): Promise<ActiveOrganization | null> {
	const role = memberships.find((m) => m.organizationId === organizationId)?.role ?? null;
	if (!role && !actor.isSuperadmin) return null;
	const org = await orgRepo.findOrganizationById(organizationId);
	if (!org) return null;
	if (org.id !== (session.activeOrganizationId ?? null)) await sessionRepo.setActiveOrganization(session.id, org.id);
	return toActiveOrganization(org, role);
}

/** The organization of an application, if the actor may open it (former /applications/<id> links). */
export async function organizationOfApplication(
	actor: Actor,
	memberships: { organizationId: string }[],
	applicationId: string
): Promise<string | null> {
	const organizationId = await orgRepo.findOrganizationIdOfApplication(applicationId);
	if (!organizationId) return null;
	return actor.isSuperadmin || memberships.some((m) => m.organizationId === organizationId) ? organizationId : null;
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
