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
		// Console accounts are the superadmin's to manage (§32).
		editable: viewer.isSuperadmin,
		signedIn: !!last && last.expiresAt > now,
		lastActiveAt: last?.updatedAt ?? null
	};
}
