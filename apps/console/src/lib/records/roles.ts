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

/** Two-factor auth is mandatory for the superadmin and for every organization Admin
 *  (DECISIONS.md §9, §26). `isMember`: the account belongs to at least one organization. */
export function requiresTwoFactor(role: string | null | undefined, isMember = false): boolean {
	return isSuperadmin(role) || isMember;
}

/** Human label of a stored role (an unknown value is shown as is). */
export function labelForRole(role: string | null | undefined): string {
	return (ROLES as readonly string[]).includes(role ?? '') ? roleLabel[role as Role] : (role ?? '');
}
