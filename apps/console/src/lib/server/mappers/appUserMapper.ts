import type { AppUserRole, AppUserStatus } from '$lib/records/appUsers';
import type { AppUserListItem } from '$lib/viewmodels/appUser';

type AppUserRow = {
	id: string;
	name: string;
	email: string;
	role: AppUserRole;
	passwordHash: string | null;
	disabledAt: Date | null;
	lastLoginAt: Date | null;
	createdAt: Date;
	tokens: { expiresAt: Date }[];
};

/** The status is derived, never stored: disabled wins, then « no password yet » = invited. */
export function appUserStatus(user: { passwordHash: string | null; disabledAt: Date | null }): AppUserStatus {
	if (user.disabledAt) return 'DISABLED';
	return user.passwordHash ? 'ACTIVE' : 'INVITED';
}

export function toAppUserListItem(
	row: AppUserRow,
	personal: { bytes: bigint; files: number } | undefined,
	now = new Date()
): AppUserListItem {
	const status = appUserStatus(row);
	const link = row.tokens[0];
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		status,
		invitationExpired: status === 'INVITED' && (!link || link.expiresAt <= now),
		lastLoginAt: row.lastLoginAt,
		createdAt: row.createdAt,
		personalBytes: Number(personal?.bytes ?? 0n),
		personalFiles: personal?.files ?? 0
	};
}
