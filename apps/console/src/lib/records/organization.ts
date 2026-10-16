// Organization roles, rights and plans — presentation config + the single permission table.
// Client-safe (no server import): pages use it to show / hide actions, services to enforce them.

/** Every console member is an « Admin » of its organization (DECISIONS.md §26): finer roles
 *  (super user, user, guest) belong to the applications' users, never to the console. */
export const ORG_ROLES = ['OWNER'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const orgRoleLabel: Record<OrgRole, string> = {
	OWNER: 'Admin'
};

/** The operator of the instance (G2 WebDev): sees and manages every organization. */
export const SUPERADMIN_LABEL = 'Superadmin';

/** What a member may do in its organization (DECISIONS.md §3, §26). The superadmin may do everything.
 *  `appUsers.manage`: invite / disable / delete the users of the applications' portals (§24). */
export type OrgPermission =
	| 'organization.manage'
	| 'members.manage'
	| 'applications.manage'
	| 'appUsers.manage'
	| 'files.write'
	| 'read';

const PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
	// No `members.manage` nor `applications.manage`: console accounts (even their list), applications,
	// their API keys and their « Se connecter avec G2 Hub » settings are the superadmin's (§32, §33) —
	// G2 Webdev builds the client's sites. An Admin manages its applications' files and users, and
	// its organization's profile.
	OWNER: ['organization.manage', 'appUsers.manage', 'files.write', 'read']
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

export const isQuotaTier = (bytes: number) => (QUOTA_TIERS as readonly number[]).includes(bytes);

/** The tier above `quotaBytes`, or null at the top (DECISIONS.md §10). */
export function nextQuotaTier(quotaBytes: number): number | null {
	return QUOTA_TIERS.find((t) => t > quotaBytes) ?? null;
}

// ─── Storage usage (step 4) ─────────────────────────────────────────────────

/** From this share of the quota on, the Admin is warned that the space is running out. */
export const STORAGE_WARNING_PERCENT = 80;

/** OK; WARNING = running out; FULL = uploads are refused (strict quota, §10). */
export type UsageLevel = 'OK' | 'WARNING' | 'FULL';

/** Share of the quota used, 0–100 (rounded, capped). */
export function usagePercent(usedBytes: number, quotaBytes: number): number {
	return quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 100;
}

export function usageLevel(usedBytes: number, quotaBytes: number): UsageLevel {
	if (usedBytes >= quotaBytes) return 'FULL';
	return usagePercent(usedBytes, quotaBytes) >= STORAGE_WARNING_PERCENT ? 'WARNING' : 'OK';
}

/** Color of the usage gauge / badge. */
export const usageLevelColor: Record<UsageLevel, 'primary' | 'warning' | 'danger'> = {
	OK: 'primary',
	WARNING: 'warning',
	FULL: 'danger'
};

/** Badge of the usage share (organizations list). */
export const usageBadgeVariant: Record<UsageLevel, 'default' | 'warning' | 'danger'> = {
	OK: 'default',
	WARNING: 'warning',
	FULL: 'danger'
};

/** Offer label: storage is an option (DECISIONS.md §12). */
export function offerLabel(storageEnabled: boolean): string {
	return storageEnabled ? 'Accès + Stockage' : 'Accès';
}

// ─── « Mon organisation » (DECISIONS.md §31) ───────────────────────────────────

/** SUSPENDED is informative for now: nothing is blocked (§31). */
export const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const organizationStatusLabel: Record<OrganizationStatus, string> = {
	ACTIVE: 'Active',
	SUSPENDED: 'Suspendue'
};

export const organizationStatusVariant: Record<OrganizationStatus, 'success' | 'warning'> = {
	ACTIVE: 'success',
	SUSPENDED: 'warning'
};

export const organizationStatusOptions = ORGANIZATION_STATUSES.map((s) => ({ value: s, label: organizationStatusLabel[s] }));

/** The logo an Admin uploads: an image, resized by the hub to a small WebP. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
