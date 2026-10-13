import type { OrgRole } from '$lib/records/organization';

/** A row of the members list of the active organization. */
export type MemberListItem = {
	membershipId: string;
	userId: string;
	name: string;
	email: string;
	role: OrgRole;
	twoFactorEnabled: boolean;
	isMe: boolean;
};

/** Result of adding a member: the one-time password when an account was created. */
export type AddedMember = {
	email: string;
	/** Shown ONCE to be handed over; null when the person already had an account. */
	temporaryPassword: string | null;
};
