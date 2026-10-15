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
	/** Disabled: no sign-in possible, the account and its memberships are kept. */
	disabled: boolean;
	/** Also a member of another organization: a change applies there too (§30). */
	shared: boolean;
	/** May the viewer edit, disable, sign out or reset this account? (the superadmin only, §32) */
	editable: boolean;
	/** The superadmin's account (shown with its own badge). */
	isSuperadmin: boolean;
	/** Has not chosen a password yet (invitation sent, link not used). */
	invited: boolean;
	/** Holds a console session that has not expired. */
	signedIn: boolean;
	/** Last activity of its most recent session. */
	lastActiveAt: Date | null;
};

/** Result of adding a member. */
export type AddedMember = {
	email: string;
	/** A new account: an invitation e-mail was sent (false = the person already had an account). */
	invited: boolean;
};
