import { prisma } from '$lib/server/db';
import * as membershipRepo from '$lib/server/repositories/membershipRepository';
import * as userRepo from '$lib/server/repositories/userRepository';
import { toMemberListItem } from '$lib/server/mappers/memberMapper';
import { assertCan, type OrgContext } from '$lib/server/context';
import { HubError, notFound } from '$lib/server/errors';
import { ensureAccount, sendInvitation } from './accountService';
import * as accounts from './consoleAccountService';
import type { OrgRole } from '$lib/records/organization';
import type { AddedMember, MemberListItem } from '$lib/viewmodels/member';

// Members of an organization (ctx built by the hook from the /o/<id> address — DECISIONS.md §34); every member
// is an Admin (§26). Console accounts are the operator's: only the SUPERADMIN lists, adds, edits,
// signs out, disables or removes them (§32, §33) — an Admin gets a 403 and manages the users of its
// applications instead. An organization always keeps at least one (enabled) Admin.

export async function listMembers(ctx: OrgContext, search?: string): Promise<MemberListItem[]> {
	assertCan(ctx, 'members.manage');
	const rows = await membershipRepo.listMembers(ctx.organization.id, search);
	const now = new Date();
	return rows.map((r) => toMemberListItem(r, { userId: ctx.userId, isSuperadmin: ctx.isSuperadmin }, now));
}

/** A member of THIS organization, for an action of the superadmin (403 for anyone else, 404 for an
 *  unknown id). The action itself is the account's (consoleAccountService). */
async function memberAccount(ctx: OrgContext, membershipId: string) {
	assertCan(ctx, 'members.manage');
	const member = await membershipRepo.findMemberInOrganization(ctx.organization.id, membershipId);
	if (!member) throw notFound('Membre introuvable.');
	return { actor: { id: ctx.userId, isSuperadmin: ctx.isSuperadmin }, userId: member.userId };
}

export async function updateMember(ctx: OrgContext, membershipId: string, input: { name: string; email: string }) {
	const { actor, userId } = await memberAccount(ctx, membershipId);
	return accounts.updateAccount(actor, userId, input);
}

export async function sendMemberPasswordReset(ctx: OrgContext, membershipId: string) {
	const { actor, userId } = await memberAccount(ctx, membershipId);
	return accounts.sendAccountPasswordReset(actor, userId);
}

export async function revokeMemberSessions(ctx: OrgContext, membershipId: string) {
	const { actor, userId } = await memberAccount(ctx, membershipId);
	return accounts.revokeAccountSessions(actor, userId);
}

export async function setMemberDisabled(ctx: OrgContext, membershipId: string, disabled: boolean) {
	const { actor, userId } = await memberAccount(ctx, membershipId);
	return accounts.setAccountDisabled(actor, userId, disabled);
}

export async function resetMemberTwoFactor(ctx: OrgContext, membershipId: string) {
	const { actor, userId } = await memberAccount(ctx, membershipId);
	return accounts.resetAccountTwoFactor(actor, userId);
}

export async function resendMemberInvitation(ctx: OrgContext, membershipId: string) {
	const { actor, userId } = await memberAccount(ctx, membershipId);
	return accounts.resendAccountInvitation(actor, userId);
}

/** Add someone to the organization. A new account is invited by e-mail; if the e-mail cannot be
 *  sent, the account is removed again (an invitation nobody received helps no one). */
export async function addMember(
	ctx: OrgContext,
	input: { name: string; email: string }
): Promise<AddedMember> {
	assertCan(ctx, 'members.manage');
	const organizationId = ctx.organization.id;
	const email = input.email.trim().toLowerCase();
	const account = await prisma.$transaction(async (tx) => {
		const found = await ensureAccount({ name: input.name, email }, tx);
		if (await membershipRepo.findMembership(organizationId, found.userId)) {
			throw new HubError('Cette personne est déjà membre de l’organisation.', { field: 'email' });
		}
		await membershipRepo.createMembership({ organizationId, userId: found.userId, role: 'OWNER' }, tx);
		return found;
	});
	if (account.created) {
		try {
			await sendInvitation({ userId: account.userId, name: input.name.trim(), email }, ctx.organization.name);
		} catch (err) {
			await userRepo.deleteUser(account.userId);
			throw err;
		}
	}
	return { email, invited: account.created };
}

/** Refuse to leave the organization without an Admin. */
async function assertKeepsAnOwner(organizationId: string, member: { role: OrgRole }) {
	if (member.role === 'OWNER' && (await membershipRepo.countOwners(organizationId)) <= 1) {
		throw new HubError('L’organisation doit garder au moins un admin.');
	}
}

/**
 * Remove someone from the organization. An account left in no organization at all is deleted (it
 * could still sign in and see nothing) — unless it is the superadmin's.
 */
export async function removeMember(ctx: OrgContext, membershipId: string): Promise<string> {
	assertCan(ctx, 'members.manage');
	const organizationId = ctx.organization.id;
	const member = await membershipRepo.findMemberInOrganization(organizationId, membershipId);
	if (!member) throw notFound('Membre introuvable.');
	await assertKeepsAnOwner(organizationId, member);

	await prisma.$transaction(async (tx) => {
		await membershipRepo.deleteMembership(organizationId, membershipId, tx);
		if ((await membershipRepo.countMembershipsOfUser(member.userId, tx)) === 0) {
			const user = await userRepo.findUserRole(member.userId, tx);
			if (user && user.role !== 'superadmin') await userRepo.deleteUser(member.userId, tx);
		}
	});
	return member.user.email;
}
