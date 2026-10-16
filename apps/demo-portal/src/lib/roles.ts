// The `role` claim « Se connecter avec G2 Hub » sends (G2 Hub DECISIONS.md §26). The hub only says
// WHO the user is and their role; the portal decides what each role may do — here, only `admin`
// (an Admin of the client's organization) sees the « Administration » section. `client` = an Admin
// of ANOTHER organization, on an application of the platform (§38).

export const PORTAL_ROLES = ['admin', 'client', 'superuser', 'user', 'guest'] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export const portalRoleLabel: Record<PortalRole, string> = {
	admin: 'Admin',
	client: 'Client',
	superuser: 'Super utilisateur',
	user: 'Utilisateur',
	guest: 'Visiteur'
};

/** An unknown or missing value is treated as the least privileged role. */
export function toPortalRole(value: unknown): PortalRole {
	return (PORTAL_ROLES as readonly unknown[]).includes(value) ? (value as PortalRole) : 'guest';
}
