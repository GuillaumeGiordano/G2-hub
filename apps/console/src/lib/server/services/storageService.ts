import * as fileRepo from '$lib/server/repositories/fileRepository';
import * as applicationRepo from '$lib/server/repositories/applicationRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { upgradeUrl } from '$lib/server/instance';
import { FILE_KINDS } from '$lib/records/files';
import { nextQuotaTier, usageLevel, usagePercent } from '$lib/records/organization';
import type { StorageOverview } from '$lib/viewmodels/storage';
import { assertStorageEnabled } from './folderService';

// The organization's storage as its Admins see it (« Stockage », step 4): how much of the quota is
// used, by which application and kind of file — to clean up, or ask for the next tier. Scoped by the
// session's organization (§13). The quota itself is changed by the superadmin or, later, the
// G2 WebDev portal through the internal API.

export async function overview(ctx: OrgContext): Promise<StorageOverview> {
	assertCan(ctx, 'read');
	assertStorageEnabled(ctx);
	const organizationId = ctx.organization.id;
	const [rows, applications] = await Promise.all([
		fileRepo.usageBreakdown(organizationId),
		applicationRepo.listApplications(organizationId)
	]);

	const usedBytes = rows.reduce((sum, r) => sum + Number(r.bytes), 0);
	const quotaBytes = ctx.organization.quotaBytes;
	const sum = (pick: (r: (typeof rows)[number]) => boolean) => {
		const bytes = rows.filter(pick).reduce((acc, r) => acc + Number(r.bytes), 0);
		const files = rows.filter(pick).reduce((acc, r) => acc + r.files, 0);
		return { bytes, files, percent: usedBytes > 0 ? Math.round((bytes / usedBytes) * 100) : 0 };
	};

	return {
		usedBytes,
		quotaBytes,
		percent: usagePercent(usedBytes, quotaBytes),
		level: usageLevel(usedBytes, quotaBytes),
		nextQuotaBytes: nextQuotaTier(quotaBytes),
		byApplication: applications
			.map((a) => ({ id: a.id, name: a.name, ...sum((r) => r.applicationId === a.id) }))
			.sort((a, b) => b.bytes - a.bytes),
		byKind: FILE_KINDS.map((kind) => ({ kind, ...sum((r) => r.kind === kind) })),
		upgradeUrl: upgradeUrl()
	};
}
