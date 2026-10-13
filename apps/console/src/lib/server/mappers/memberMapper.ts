import type { OrgRole } from '$lib/records/organization';
import type { MemberListItem } from '$lib/viewmodels/member';

type MemberRow = {
	id: string;
	role: OrgRole;
	user: { id: string; name: string; email: string; twoFactorEnabled: boolean };
};

export function toMemberListItem(row: MemberRow, currentUserId: string): MemberListItem {
	return {
		membershipId: row.id,
		userId: row.user.id,
		name: row.user.name,
		email: row.user.email,
		role: row.role,
		twoFactorEnabled: row.user.twoFactorEnabled,
		isMe: row.user.id === currentUserId
	};
}
