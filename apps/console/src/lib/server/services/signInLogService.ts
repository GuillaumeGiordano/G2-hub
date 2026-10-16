import * as signInRepo from '$lib/server/repositories/signInEventRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { forbidden } from '$lib/server/errors';
import {
	FAILED_OUTCOMES,
	SIGN_IN_RETENTION_DAYS,
	type SignInFilter,
	type SignInMethod,
	type SignInOutcome
} from '$lib/records/signIns';
import { describeUserAgent } from '$lib/utils/userAgent';
import type { SignInClient, SignInEventItem } from '$lib/viewmodels/signIn';
import { applicationOrThrow } from './folderService';

// Sign-in log of the applications (DECISIONS.md §40): every attempt to sign in to an application
// (password, console session, e-mailed link), shown to its organization's Admins. Kept 6 months.

const DAY_MS = 24 * 3600_000;

/** Where a sign-in comes from, from a SvelteKit request (the IP is the client's only when the
 *  proxy's header is configured: ADDRESS_HEADER / XFF_DEPTH in production). */
export function clientOf(event: { request: Request; getClientAddress: () => string }): SignInClient {
	let ipAddress: string | null = null;
	try {
		ipAddress = event.getClientAddress();
	} catch {
		// No address (some adapters / tests): the event is kept without it.
	}
	return { ipAddress, userAgent: event.request.headers.get('user-agent') };
}

/**
 * Record an attempt. Never blocks nor breaks the sign-in: it runs in the background and a failure
 * is only logged.
 */
export function recordSignIn(event: {
	organizationId: string;
	applicationId: string;
	appUserId?: string | null;
	userId?: string | null;
	email: string;
	outcome: SignInOutcome;
	method: SignInMethod;
	client: SignInClient;
}): void {
	const { client, ...rest } = event;
	signInRepo
		.createSignInEvent({
			...rest,
			email: event.email.trim().toLowerCase().slice(0, 320),
			ipAddress: client.ipAddress?.slice(0, 64) ?? null,
			userAgent: client.userAgent?.slice(0, 512) ?? null
		})
		.catch((err) => console.error('[sign-in log] write failed:', err));
}

/** The log of one application of the open organization (its Admins, with the Auth offer). */
export async function listSignIns(
	ctx: OrgContext,
	applicationId: string,
	params: { search?: string; filter: SignInFilter; page: number; perPage: number }
): Promise<{ items: SignInEventItem[]; total: number }> {
	assertCan(ctx, 'appUsers.manage');
	if (!ctx.organization.authEnabled) throw forbidden("L'offre Auth n'est pas activée pour cette organisation.");
	await applicationOrThrow(ctx, applicationId);
	const outcomes =
		params.filter === 'success' ? (['SUCCESS'] as const) : params.filter === 'failed' ? FAILED_OUTCOMES : undefined;
	const scope = { organizationId: ctx.organization.id, applicationId, search: params.search, outcomes };
	const [rows, total] = await Promise.all([
		signInRepo.searchSignInEvents({ ...scope, skip: (params.page - 1) * params.perPage, take: params.perPage }),
		signInRepo.countSignInEvents(scope)
	]);
	return {
		items: rows.map((r) => ({
			id: r.id,
			createdAt: r.createdAt,
			name: r.appUser?.name ?? r.user?.name ?? null,
			email: r.email,
			outcome: r.outcome,
			method: r.method,
			ipAddress: r.ipAddress,
			device: describeUserAgent(r.userAgent)
		})),
		total
	};
}

/** Retention (worker): events older than SIGN_IN_RETENTION_DAYS are deleted. */
export function purgeOldSignIns(): Promise<number> {
	return signInRepo.purgeSignInEventsBefore(new Date(Date.now() - SIGN_IN_RETENTION_DAYS * DAY_MS));
}
