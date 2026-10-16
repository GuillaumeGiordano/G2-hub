import { can } from '$lib/records/organization';
import { SIGN_IN_FILTERS, type SignInFilter } from '$lib/records/signIns';
import { DEFAULT_PER_PAGE } from '$lib/constants';
import { loadFailure } from '$lib/server/http';
import * as folderService from '$lib/server/services/folderService';
import * as signInLogService from '$lib/server/services/signInLogService';
import type { PageServerLoad } from './$types';

// Sign-in log of one application (DECISIONS.md §40): its organization's Admins and the superadmin,
// with the Auth offer (the service answers 403 otherwise). Read-only.

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const ctx = locals.orgContext!;
	const search = url.searchParams.get('q')?.trim() || undefined;
	const raw = url.searchParams.get('result') ?? 'all';
	const filter: SignInFilter = (SIGN_IN_FILTERS as readonly string[]).includes(raw) ? (raw as SignInFilter) : 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const perPage = Number(url.searchParams.get('perPage')) || DEFAULT_PER_PAGE;
	try {
		const [application, { items, total }] = await Promise.all([
			folderService.applicationOrThrow(ctx, params.id),
			signInLogService.listSignIns(ctx, params.id, { search, filter, page, perPage })
		]);
		return {
			application,
			items,
			total,
			page,
			perPage,
			canManageKeys: can(ctx.organization.role, ctx.isSuperadmin, 'applications.manage')
		};
	} catch (err) {
		loadFailure(err);
	}
};
