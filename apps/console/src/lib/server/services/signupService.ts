import { randomBytes } from 'node:crypto';
import { SIGNUP_LINK_VALID_HOURS, UNCONFIRMED_SIGNUP_DAYS } from '$lib/constants';
import type { PlatformAccess } from '$lib/records/platform';
import { prisma } from '$lib/server/db';
import { HubError } from '$lib/server/errors';
import { hubName, hubUrl, signupEnabled } from '$lib/server/instance';
import { sendMail } from '$lib/server/mail/mailer';
import { signupAlreadyRegisteredMail, signupConfirmMail } from '$lib/server/mail/templates';
import { allowHit, SIGNUP_PER_IP } from '$lib/server/rateLimit';
import * as userRepo from '$lib/server/repositories/userRepository';
import { safeRedirect } from '$lib/utils/redirect';
import type { SignInClient } from '$lib/viewmodels/signIn';
import { ensureAccount } from './accountService';
import { checkAuthorizeRequest } from './oidcService';

// Public sign-up of a console account (DECISIONS.md §45), offered only from the sign-in page of the
// platform's portal (an ALL_ADMINS application) when the instance enables it. The person gives a
// name and an address; the account is created with no usable password, and the e-mailed link (the
// invitation mechanism, §30) proves the address and lets them choose one, then sends them back to
// the portal's sign-in. The screen answers the same whether the address has an account or not.

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
/** One e-mail per address in this window, whichever e-mail it is. */
const MAIL_THROTTLE_MS = 2 * 60_000;
const AUTHORIZE_PATH = '/oauth/authorize';

/** Does this application offer « Créer un compte »? Only the portal, on an instance that allows it. */
export function signupAvailable(application: { platformAccess: PlatformAccess }): boolean {
	return signupEnabled() && application.platformAccess === 'ALL_ADMINS';
}

/**
 * Where a sign-up returns: `returnTo` must be a valid authorize request of THIS hub for an
 * application that offers sign-up — never another address (no open redirect). Else null.
 */
export async function signupTarget(returnTo: string | null): Promise<{ returnTo: string; applicationName: string } | null> {
	if (!signupEnabled() || !returnTo) return null;
	if (safeRedirect(returnTo) !== returnTo || !returnTo.startsWith(`${AUTHORIZE_PATH}?`)) return null;
	const check = await checkAuthorizeRequest(new URL(returnTo, 'http://hub.invalid').searchParams);
	if (check.kind !== 'ok' || !signupAvailable(check.request.application)) return null;
	return { returnTo, applicationName: check.request.application.name };
}

/** Create the account and e-mail its confirmation link — or, for a known address, a « you already
 *  have an account » e-mail. Silent when a limit is reached: the screen never changes. */
export async function requestSignup(input: { name: string; email: string }, returnTo: string, client: SignInClient): Promise<void> {
	if (!allowHit(client.ipAddress && `signup:${client.ipAddress}`, SIGNUP_PER_IP.max, SIGNUP_PER_IP.windowMs)) return;
	const email = input.email.trim().toLowerCase();
	if (!allowHit(`signup-mail:${email}`, 1, MAIL_THROTTLE_MS)) return;
	const base = hubUrl();
	if (!base) throw new HubError("L'adresse publique du hub (ORIGIN) n'est pas configurée.");

	if (await userRepo.findUserByEmail(email)) {
		const link = `${base}/login?${new URLSearchParams({ redirectTo: returnTo, email })}`;
		await sendMail(signupAlreadyRegisteredMail({ to: email, hubName: hubName(), link }));
		return;
	}

	const account = await prisma.$transaction((tx) => ensureAccount({ name: input.name, email }, tx));
	if (!account.created) return; // the same address signed up at the same instant
	try {
		const token = randomBytes(24).toString('base64url');
		await userRepo.createInvitationLink(account.userId, token, new Date(Date.now() + SIGNUP_LINK_VALID_HOURS * HOUR_MS));
		const link = `${base}/login/nouveau-mot-de-passe?${new URLSearchParams({ token, inscription: '1', returnTo })}`;
		await sendMail(signupConfirmMail({ to: email, name: input.name.trim(), hubName: hubName(), link, validHours: SIGNUP_LINK_VALID_HOURS }));
	} catch (err) {
		// A confirmation nobody received helps no one: the address stays free.
		await userRepo.deleteUser(account.userId);
		throw err;
	}
}

/** Housekeeping (worker): accounts never confirmed are removed after a few days. */
export async function purgeUnconfirmedSignups(): Promise<number> {
	return userRepo.deleteUnconfirmedAccounts(new Date(Date.now() - UNCONFIRMED_SIGNUP_DAYS * DAY_MS));
}
