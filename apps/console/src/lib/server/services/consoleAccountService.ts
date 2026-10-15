import { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';
import * as membershipRepo from '$lib/server/repositories/membershipRepository';
import * as orgRepo from '$lib/server/repositories/organizationRepository';
import * as userRepo from '$lib/server/repositories/userRepository';
import { toConsoleAccountListItem } from '$lib/server/mappers/memberMapper';
import { forbidden, HubError, notFound } from '$lib/server/errors';
import { ensureAccount, requestPasswordReset, sendInvitation } from './accountService';
import type { AddedMember, ConsoleAccountListItem } from '$lib/viewmodels/member';

// Console accounts (the Admins of the organizations) — the SUPERADMIN's to manage (DECISIONS.md
// §32, §35). The account-level actions live here, used by the « Membres » page of the console (every
// account) and by an organization's « Membres » tab (its members). Superadmin accounts are never
// listed nor edited here (they are created with `pnpm hub:install`). Every organization keeps at
// least one (enabled) Admin.

type Actor = { id: string; isSuperadmin: boolean };

/** How long a reset link must wait before another one is sent (same window as auth.ts). */
const RESET_THROTTLE_MS = 2 * 60_000;

function assertSuperadmin(actor: Actor) {
	if (!actor.isSuperadmin) throw forbidden();
}

/** A console account other than a superadmin's, or 404. */
async function accountOrThrow(userId: string) {
	const account = await userRepo.findUserAccount(userId);
	if (!account || account.role === 'superadmin') throw notFound('Compte introuvable.');
	return account;
}

/** Refuse when one of these organizations would be left without an Admin (or an enabled one). */
async function assertOrganizationsKeepAnAdmin(organizationIds: string[], { enabled }: { enabled: boolean }) {
	for (const organizationId of organizationIds) {
		const left = enabled ? await membershipRepo.countActiveOwners(organizationId) : await membershipRepo.countOwners(organizationId);
		if (left <= 1) {
			const org = await orgRepo.findOrganizationById(organizationId);
			throw new HubError(`« ${org?.name ?? 'Une organisation'} » doit garder au moins un admin${enabled ? ' actif' : ''}.`);
		}
	}
}

// ─── The console's « Membres » page ─────────────────────────────────────────────

export async function listAccounts(
	actor: Actor,
	params: { search?: string; page: number; perPage: number }
): Promise<{ items: ConsoleAccountListItem[]; total: number }> {
	assertSuperadmin(actor);
	const [rows, total] = await Promise.all([
		userRepo.listConsoleAccounts({ search: params.search, skip: (params.page - 1) * params.perPage, take: params.perPage }),
		userRepo.countConsoleAccounts(params.search)
	]);
	const now = new Date();
	return { items: rows.map((r) => toConsoleAccountListItem(r, now)), total };
}

/** Every organization, for the « organisations » choice of the forms. */
export async function organizationOptions(actor: Actor): Promise<{ value: string; label: string }[]> {
	assertSuperadmin(actor);
	const orgs = await orgRepo.listOrganizationNames();
	return orgs.map((o) => ({ value: o.id, label: o.name }));
}

/** Only ids of existing organizations (an id from the form is never trusted as is). */
async function knownOrganizations(organizationIds: string[]) {
	const orgs = await orgRepo.listOrganizationNamesByIds([...new Set(organizationIds)]);
	if (orgs.length === 0) throw new HubError('Choisissez au moins une organisation.', { field: 'organizationIds' });
	return orgs;
}

/** Add an account to one or more organizations. A new account is invited by e-mail (removed again
 *  if the e-mail cannot be sent); an existing one simply gains the organizations it lacked. */
export async function createAccount(
	actor: Actor,
	input: { name: string; email: string; organizationIds: string[] }
): Promise<AddedMember> {
	assertSuperadmin(actor);
	const orgs = await knownOrganizations(input.organizationIds);
	const email = input.email.trim().toLowerCase();
	const account = await prisma.$transaction(async (tx) => {
		const found = await ensureAccount({ name: input.name, email }, tx);
		const role = await userRepo.findUserRole(found.userId, tx);
		if (role?.role === 'superadmin') throw new HubError('Ce compte est un superadmin.', { field: 'email' });
		let added = 0;
		for (const org of orgs) {
			if (await membershipRepo.findMembership(org.id, found.userId)) continue;
			await membershipRepo.createMembership({ organizationId: org.id, userId: found.userId, role: 'OWNER' }, tx);
			added++;
		}
		if (added === 0) throw new HubError('Ce compte est déjà membre de ces organisations.', { field: 'email' });
		return found;
	});
	if (account.created) {
		try {
			await sendInvitation({ userId: account.userId, name: input.name.trim(), email }, orgs.map((o) => o.name).join(', '));
		} catch (err) {
			await userRepo.deleteUser(account.userId);
			throw err;
		}
	}
	return { email, invited: account.created };
}

/** The organizations of an account: added and removed to match the choice (at least one — to remove
 *  every one, delete the account). An organization it leaves must keep an Admin. */
export async function setAccountOrganizations(actor: Actor, userId: string, organizationIds: string[]): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	const wanted = new Set((await knownOrganizations(organizationIds)).map((o) => o.id));
	const current = new Set((await membershipRepo.findMembershipsOfUser(userId)).map((m) => m.organizationId));
	const removed = [...current].filter((id) => !wanted.has(id));
	await assertOrganizationsKeepAnAdmin(removed, { enabled: false });
	await prisma.$transaction(async (tx) => {
		for (const organizationId of wanted) {
			if (!current.has(organizationId)) await membershipRepo.createMembership({ organizationId, userId, role: 'OWNER' }, tx);
		}
		for (const organizationId of removed) await membershipRepo.deleteMembershipOfUser(organizationId, userId, tx);
	});
	return account.email;
}

/** Delete the account (its memberships and sessions go with it). Its organizations keep an Admin. */
export async function deleteAccount(actor: Actor, userId: string): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	const organizations = (await membershipRepo.findMembershipsOfUser(userId)).map((m) => m.organizationId);
	await assertOrganizationsKeepAnAdmin(organizations, { enabled: false });
	await userRepo.deleteUser(userId);
	return account.email;
}

// ─── Account actions (both « Membres » pages) ──────────────────────────────────

/** Name and sign-in e-mail. */
export async function updateAccount(actor: Actor, userId: string, input: { name: string; email: string }): Promise<string> {
	assertSuperadmin(actor);
	await accountOrThrow(userId);
	const email = input.email.trim().toLowerCase();
	try {
		await userRepo.updateUserProfile(userId, { name: input.name.trim(), email });
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
			throw new HubError('Cette adresse est déjà celle d’un autre compte.', { field: 'email' });
		}
		throw err;
	}
	return email;
}

/** E-mail a link to choose a new password; nobody else ever sees nor sets it. */
export async function sendAccountPasswordReset(actor: Actor, userId: string): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	if (account.disabledAt) throw new HubError("Ce compte est désactivé : réactivez-le d'abord.");
	if (!account.emailVerified) throw new HubError("Pas encore de mot de passe : utilisez « Renvoyer l'invitation ».");
	if ((await userRepo.countResetLinksSince(userId, new Date(Date.now() - RESET_THROTTLE_MS))) > 0) {
		throw new HubError('Un lien vient déjà de lui être envoyé : réessayez dans 2 minutes.');
	}
	await requestPasswordReset(account.email);
	return account.email;
}

/** A new invitation link for an account that has not chosen a password yet. */
export async function resendAccountInvitation(actor: Actor, userId: string): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	if (account.emailVerified) throw new HubError('Ce compte est déjà activé.');
	if (account.disabledAt) throw new HubError("Ce compte est désactivé : réactivez-le d'abord.");
	const orgs = await membershipRepo.findOrganizationNamesOfUser(userId);
	await sendInvitation({ userId, name: account.name, email: account.email }, orgs.map((o) => o.name).join(', '));
	return account.email;
}

/** Sign the account out everywhere (console sessions and the grants it holds as an Admin). */
export async function revokeAccountSessions(actor: Actor, userId: string): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	await userRepo.revokeUserSessions(userId);
	return account.email;
}

/** Disable (no sign-in, sessions revoked; the account is kept) or re-enable. Never the last enabled
 *  Admin of one of its organizations. */
export async function setAccountDisabled(actor: Actor, userId: string, disabled: boolean): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	if (disabled && !account.disabledAt) {
		const organizations = (await membershipRepo.findMembershipsOfUser(userId)).map((m) => m.organizationId);
		await assertOrganizationsKeepAnAdmin(organizations, { enabled: true });
	}
	await userRepo.setUserDisabled(userId, disabled ? new Date() : null);
	if (disabled) await userRepo.revokeUserSessions(userId);
	return account.email;
}

/** Remove the two-factor authentication (lost phone): sessions revoked, set up again at the next
 *  sign-in (it is required for Admins). */
export async function resetAccountTwoFactor(actor: Actor, userId: string): Promise<string> {
	assertSuperadmin(actor);
	const account = await accountOrThrow(userId);
	await userRepo.resetTwoFactor(userId);
	await userRepo.revokeUserSessions(userId);
	return account.email;
}
