import type { OrgRole } from '$lib/records/organization';
import type { MemberListItem } from '$lib/viewmodels/member';

type MemberRow = {
	id: string;
	role: OrgRole;
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
		twoFactorEnabled: boolean;
		emailVerified: boolean;
		disabledAt: Date | null;
		_count: { memberships: number };
		sessions: { updatedAt: Date; expiresAt: Date }[];
	};
};

/** May `viewer` edit this account? Only one that belongs to this organization alone and is not the
 *  superadmin's — the superadmin may edit every account (§30). */
export function canEditAccount(
	account: { role: string; memberships: number },
	viewer: { isSuperadmin: boolean }
): boolean {
	return viewer.isSuperadmin || (account.role !== 'superadmin' && account.memberships <= 1);
}

export function toMemberListItem(
	row: MemberRow,
	viewer: { userId: string; isSuperadmin: boolean },
	now = new Date()
): MemberListItem {
	const last = row.user.sessions[0];
	const shared = row.user._count.memberships > 1;
	return {
		membershipId: row.id,
		userId: row.user.id,
		name: row.user.name,
		email: row.user.email,
		role: row.role,
		twoFactorEnabled: row.user.twoFactorEnabled,
		isMe: row.user.id === viewer.userId,
		disabled: row.user.disabledAt !== null,
		isSuperadmin: row.user.role === 'superadmin',
		invited: !row.user.emailVerified,
		shared,
		editable: canEditAccount({ role: row.user.role, memberships: row.user._count.memberships }, viewer),
		signedIn: !!last && last.expiresAt > now,
		lastActiveAt: last?.updatedAt ?? null
	};
}
