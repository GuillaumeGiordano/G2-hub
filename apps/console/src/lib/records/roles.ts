// Instance-level roles of a console account. Rights INSIDE an organization come from the
// membership: every member is an Admin (DECISIONS.md §3, §26).
export const ROLES = ['superadmin', 'member'] as const;
export type Role = (typeof ROLES)[number];

export const roleLabel: Record<Role, string> = {
	superadmin: 'Super administrateur',
	member: 'Membre'
};

export function isSuperadmin(role: string | null | undefined): boolean {
	return role === 'superadmin';
}

/** Two-factor auth is mandatory for the superadmin and for the Admin of an organization with an
 *  active offer — the one who opens the console (DECISIONS.md §9, §26, §44). An account without
 *  console (a prospect, a client without plan) signs in to the portal with its password alone. */
export function requiresTwoFactor(role: string | null | undefined, adminWithOffer = false): boolean {
	return isSuperadmin(role) || adminWithOffer;
}

/** An organization with at least one offer (§12): its Admins open the console. */
export const hasActiveOffer = (organization: { authEnabled: boolean; storageEnabled: boolean }): boolean =>
	organization.authEnabled || organization.storageEnabled;

/** Human label of a stored role (an unknown value is shown as is). */
export function labelForRole(role: string | null | undefined): string {
	return (ROLES as readonly string[]).includes(role ?? '') ? roleLabel[role as Role] : (role ?? '');
}
