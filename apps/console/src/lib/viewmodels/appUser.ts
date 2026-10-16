import type { AppUserRole, AppUserStatus, PasswordLinkPurpose } from '$lib/records/appUsers';

/** A row of an application's users (console). */
export type AppUserListItem = {
	id: string;
	name: string;
	email: string;
	role: AppUserRole;
	status: AppUserStatus;
	/** Still invited, and the last invitation link has expired: send it again. */
	invitationExpired: boolean;
	lastLoginAt: Date | null;
	/** Holds an access token still valid: signed in to the portal within the last hour. */
	signedIn: boolean;
	createdAt: Date;
	/** What their personal space holds (§28) — its content is never shown in the console. */
	personalBytes: number;
	personalFiles: number;
};

/** What the « choose a password » page shows about a valid e-mailed link. */
export type PasswordLink = {
	purpose: PasswordLinkPurpose;
	name: string;
	email: string;
	applicationName: string;
};

/** The organization's application users against the Auth offer's limit (dashboard, §39). */
export type AppUserUsage = {
	total: number;
	max: number;
	/** Signed in within the last ACTIVE_USER_DAYS days. */
	active: number;
};
