import { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';
import * as membershipRepo from '$lib/server/repositories/membershipRepository';
import * as userRepo from '$lib/server/repositories/userRepository';
import { toMemberListItem } from '$lib/server/mappers/memberMapper';
import { assertCan, type OrgContext } from '$lib/server/context';
import { HubError, notFound } from '$lib/server/errors';
import { ensureAccount, requestPasswordReset, sendInvitation } from './accountService';
import type { OrgRole } from '$lib/records/organization';
import type { AddedMember, MemberListItem } from '$lib/viewmodels/member';

// Members of the ACTIVE organization (ctx comes from the session — DECISIONS.md §13); every member
// is an Admin (§26). Console accounts are the operator's: only the SUPERADMIN adds, edits, signs
// out, disables or removes them (§32). An Admin sees the list (`members.read`) and manages the
// users of its applications instead. An organization always keeps at least one (enabled) Admin.

/** How long a reset link must wait before another one is sent (same window as auth.ts). */
const RESET_THROTTLE_MS = 2 * 60_000;

export async function listMembers(ctx: OrgContext, search?: string): Promise<MemberListItem[]> {
	assertCan(ctx, 'members.read');
	const rows = await membershipRepo.listMembers(ctx.organization.id, search);
	const now = new Date();
	return rows.map((r) => toMemberListItem(r, { userId: ctx.userId, isSuperadmin: ctx.isSuperadmin }, now));
}

/** A member of THIS organization, for an action of the superadmin (403 for anyone else, 404 for an
 *  unknown id). */
async function editableMember(ctx: OrgContext, membershipId: string) {
	assertCan(ctx, 'members.manage');
	const member = await membershipRepo.findMemberInOrganization(ctx.organization.id, membershipId);
	if (!member) throw notFound('Membre introuvable.');
	const account = await userRepo.findUserAccount(member.userId);
	if (!account) throw notFound('Membre introuvable.');
	return { ...member, account, isMe: member.userId === ctx.userId };
}

/** Name and sign-in e-mail. */
export async function updateMember(
	ctx: OrgContext,
	membershipId: string,
	input: { name: string; email: string }
): Promise<string> {
	const member = await editableMember(ctx, membershipId);
	const email = input.email.trim().toLowerCase();
	try {
		await userRepo.updateUserProfile(member.userId, { name: input.name.trim(), email });
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
			throw new HubError('Cette adresse est déjà celle d’un autre compte.', { field: 'email' });
		}
		throw err;
	}
	return email;
}

/** E-mail the member a link to choose a new password; the Admin never sees nor sets it. */
export async function sendMemberPasswordReset(ctx: OrgContext, membershipId: string): Promise<string> {
	const member = await editableMember(ctx, membershipId);
	if (member.account.disabledAt) throw new HubError("Ce compte est désactivé : réactivez-le d'abord.");
	if (!member.account.emailVerified) throw new HubError("Pas encore de mot de passe : utilisez « Renvoyer l'invitation ».");
	if ((await userRepo.countResetLinksSince(member.userId, new Date(Date.now() - RESET_THROTTLE_MS))) > 0) {
		throw new HubError('Un lien vient déjà de lui être envoyé : réessayez dans 2 minutes.');
	}
	await requestPasswordReset(member.account.email);
	return member.account.email;
}

/** Sign the member out everywhere (console sessions and the grants held as an Admin). */
export async function revokeMemberSessions(ctx: OrgContext, membershipId: string): Promise<string> {
	const member = await editableMember(ctx, membershipId);
	await userRepo.revokeUserSessions(member.userId);
	return member.account.email;
}

/** Disable (no sign-in, sessions revoked; the account is kept) or re-enable. Never your own
 *  account, never the last enabled Admin of the organization. */
export async function setMemberDisabled(ctx: OrgContext, membershipId: string, disabled: boolean): Promise<string> {
	const member = await editableMember(ctx, membershipId);
	if (disabled) {
		if (member.isMe) throw new HubError('Vous ne pouvez pas désactiver votre propre compte.');
		if (!member.account.disabledAt && (await membershipRepo.countActiveOwners(ctx.organization.id)) <= 1) {
			throw new HubError('L’organisation doit garder au moins un admin actif.');
		}
	}
	await userRepo.setUserDisabled(member.userId, disabled ? new Date() : null);
	if (disabled) await userRepo.revokeUserSessions(member.userId);
	return member.account.email;
}

/** Remove the member's two-factor authentication (lost phone): their sessions are revoked, and as
 *  2FA is required for Admins they set it up again at their next sign-in. Your own is managed in
 *  « Sécurité ». */
export async function resetMemberTwoFactor(ctx: OrgContext, membershipId: string): Promise<string> {
	const member = await editableMember(ctx, membershipId);
	if (member.isMe) throw new HubError('Gérez votre propre double authentification depuis « Sécurité ».');
	await userRepo.resetTwoFactor(member.userId);
	await userRepo.revokeUserSessions(member.userId);
	return member.account.email;
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

/** A new invitation link for a member who has not chosen a password yet. */
export async function resendMemberInvitation(ctx: OrgContext, membershipId: string): Promise<string> {
	const member = await editableMember(ctx, membershipId);
	if (member.account.emailVerified) throw new HubError('Ce compte est déjà activé.');
	if (member.account.disabledAt) throw new HubError("Ce compte est désactivé : réactivez-le d'abord.");
	await sendInvitation({ userId: member.userId, name: member.account.name, email: member.account.email }, ctx.organization.name);
	return member.account.email;
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
