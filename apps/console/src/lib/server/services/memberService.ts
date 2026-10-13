import { prisma } from '$lib/server/db';
import * as membershipRepo from '$lib/server/repositories/membershipRepository';
import * as userRepo from '$lib/server/repositories/userRepository';
import { toMemberListItem } from '$lib/server/mappers/memberMapper';
import { assertCan, type OrgContext } from '$lib/server/context';
import { HubError, notFound } from '$lib/server/errors';
import { ensureAccount } from './accountService';
import type { OrgRole } from '$lib/records/organization';
import type { AddedMember, MemberListItem } from '$lib/viewmodels/member';

// Members of the ACTIVE organization (ctx comes from the session — DECISIONS.md §13). Managed by
// its owners (and the superadmin). An organization always keeps at least one owner.

export async function listMembers(ctx: OrgContext): Promise<MemberListItem[]> {
	assertCan(ctx, 'members.manage');
	const rows = await membershipRepo.listMembers(ctx.organization.id);
	return rows.map((r) => toMemberListItem(r, ctx.userId));
}

/** Add someone to the organization; an account is created (temporary password) if needed. */
export async function addMember(
	ctx: OrgContext,
	input: { name: string; email: string; role: OrgRole }
): Promise<AddedMember> {
	assertCan(ctx, 'members.manage');
	const organizationId = ctx.organization.id;
	return prisma.$transaction(async (tx) => {
		const account = await ensureAccount({ name: input.name, email: input.email }, tx);
		if (await membershipRepo.findMembership(organizationId, account.userId)) {
			throw new HubError('Cette personne est déjà membre de l’organisation.', { field: 'email' });
		}
		await membershipRepo.createMembership({ organizationId, userId: account.userId, role: input.role }, tx);
		return { email: input.email, temporaryPassword: account.temporaryPassword };
	});
}

/** Refuse to leave the organization without an owner. */
async function assertKeepsAnOwner(organizationId: string, member: { role: OrgRole }) {
	if (member.role === 'OWNER' && (await membershipRepo.countOwners(organizationId)) <= 1) {
		throw new HubError('L’organisation doit garder au moins un propriétaire.');
	}
}

export async function changeRole(ctx: OrgContext, membershipId: string, role: OrgRole): Promise<string> {
	assertCan(ctx, 'members.manage');
	const organizationId = ctx.organization.id;
	const member = await membershipRepo.findMemberInOrganization(organizationId, membershipId);
	if (!member) throw notFound('Membre introuvable.');
	if (role !== 'OWNER') await assertKeepsAnOwner(organizationId, member);
	await membershipRepo.updateRole(organizationId, membershipId, role);
	return member.user.email;
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
