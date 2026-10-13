import type { AppUserStatus, PasswordLinkPurpose } from '$lib/records/appUsers';

/** A row of an application's users (console). */
export type AppUserListItem = {
	id: string;
	name: string;
	email: string;
	status: AppUserStatus;
	/** Still invited, and the last invitation link has expired: send it again. */
	invitationExpired: boolean;
	lastLoginAt: Date | null;
	createdAt: Date;
};

/** What the « choose a password » page shows about a valid e-mailed link. */
export type PasswordLink = {
	purpose: PasswordLinkPurpose;
	name: string;
	email: string;
	applicationName: string;
};
