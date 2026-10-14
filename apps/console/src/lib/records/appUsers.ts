// Application users (portal end users) — presentation config + link lifetimes. Client-safe.
// DECISIONS.md §24.

export const APP_USER_STATUSES = ['INVITED', 'ACTIVE', 'DISABLED'] as const;
export type AppUserStatus = (typeof APP_USER_STATUSES)[number];

export const appUserStatusLabel: Record<AppUserStatus, string> = {
	INVITED: 'Invité',
	ACTIVE: 'Actif',
	DISABLED: 'Désactivé'
};

export const appUserStatusVariant: Record<AppUserStatus, 'info' | 'success' | 'default'> = {
	INVITED: 'info',
	ACTIVE: 'success',
	DISABLED: 'default'
};

/** Roles of an application user, by importance (DECISIONS.md §26). The portal receives them in the
 *  `role` claim and decides what each may do. */
export const APP_USER_ROLES = ['SUPER_USER', 'USER', 'GUEST'] as const;
export type AppUserRole = (typeof APP_USER_ROLES)[number];
export const DEFAULT_APP_USER_ROLE: AppUserRole = 'USER';

export const appUserRoleLabel: Record<AppUserRole, string> = {
	SUPER_USER: 'Super utilisateur',
	USER: 'Utilisateur',
	// Not « Invité »: that is already the status of an account whose invitation is pending.
	GUEST: 'Visiteur'
};

export const appUserRoleVariant: Record<AppUserRole, 'primary' | 'info' | 'default'> = {
	SUPER_USER: 'primary',
	USER: 'info',
	GUEST: 'default'
};

export const appUserRoleOptions = APP_USER_ROLES.map((r) => ({ value: r, label: appUserRoleLabel[r] }));

/** How long the e-mailed links stay valid. */
export const INVITATION_VALID_DAYS = 7;
export const PASSWORD_RESET_VALID_MINUTES = 60;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** What the e-mailed link is for — titles of the « choose a password » page. */
export type PasswordLinkPurpose = 'INVITATION' | 'PASSWORD_RESET';

export const passwordLinkTitle: Record<PasswordLinkPurpose, string> = {
	INVITATION: 'Activez votre compte',
	PASSWORD_RESET: 'Nouveau mot de passe'
};
