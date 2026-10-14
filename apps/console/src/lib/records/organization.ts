// Organization roles, rights and plans — presentation config + the single permission table.
// Client-safe (no server import): pages use it to show / hide actions, services to enforce them.

/** Every console member is an « Admin » of its organization (DECISIONS.md §26): finer roles
 *  (super user, user, guest) belong to the applications' users, never to the console. */
export const ORG_ROLES = ['OWNER'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const orgRoleLabel: Record<OrgRole, string> = {
	OWNER: 'Admin'
};

/** What a member may do in its organization (DECISIONS.md §3, §26). The superadmin may do everything.
 *  `appUsers.manage`: invite / disable / delete the users of the applications' portals (§24). */
export type OrgPermission = 'members.manage' | 'applications.manage' | 'appUsers.manage' | 'files.write' | 'read';

const PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
	OWNER: ['members.manage', 'applications.manage', 'appUsers.manage', 'files.write', 'read']
};

/** `role` null = the superadmin working in an organization it is not a member of. */
export function can(role: OrgRole | null, isSuperadmin: boolean, permission: OrgPermission): boolean {
	if (isSuperadmin) return true;
	return role !== null && PERMISSIONS[role].includes(permission);
}

// ─── Plans (storage quota) ──────────────────────────────────────────────────

const GB = 1024 ** 3;

/** Storage tiers of the shared instance: 1 → 5 → 20 GB (DECISIONS.md §10). */
export const QUOTA_TIERS = [1 * GB, 5 * GB, 20 * GB] as const;
export const DEFAULT_QUOTA_BYTES = QUOTA_TIERS[0];

export function formatBytes(bytes: number): string {
	if (bytes >= GB) return `${(bytes / GB).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`;
	const MB = 1024 ** 2;
	return `${(bytes / MB).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export const quotaOptions = QUOTA_TIERS.map((b) => ({ value: String(b), label: formatBytes(b) }));

/** Offer label: storage is an option (DECISIONS.md §12). */
export function offerLabel(storageEnabled: boolean): string {
	return storageEnabled ? 'Accès + Stockage' : 'Accès';
}
