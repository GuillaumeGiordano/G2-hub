// Instance-level roles of a console account. Rights INSIDE an organization (owner / editor /
// viewer) come from the membership (step 1, see DECISIONS.md §3).
export const ROLES = ['superadmin', 'member'] as const;
export type Role = (typeof ROLES)[number];

export const roleLabel: Record<Role, string> = {
	superadmin: 'Super administrateur',
	member: 'Membre'
};

export function isSuperadmin(role: string | null | undefined): boolean {
	return role === 'superadmin';
}

/** Two-factor auth is mandatory for the superadmin (and, from step 1, organization owners). */
export function requiresTwoFactor(role: string | null | undefined): boolean {
	return isSuperadmin(role);
}

/** Human label of a stored role (an unknown value is shown as is). */
export function labelForRole(role: string | null | undefined): string {
	return (ROLES as readonly string[]).includes(role ?? '') ? roleLabel[role as Role] : (role ?? '');
}
