import { randomBytes } from 'node:crypto';
import type { Prisma } from '@g2-hub/db';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { CONSOLE_INVITATION_VALID_DAYS } from '$lib/constants';
import { HubError } from '$lib/server/errors';
import { hubName, hubUrl } from '$lib/server/instance';
import { sendMail } from '$lib/server/mail/mailer';
import { consoleInvitationMail } from '$lib/server/mail/templates';
import * as userRepo from '$lib/server/repositories/userRepository';

// Console accounts created by an operator (no public sign-up). A new account is INVITED by e-mail
// (DECISIONS.md §30): it is created with a random password nobody knows, and the person chooses
// theirs from the link — nobody ever reads or hands over a password.

const DAY_MS = 24 * 3600_000;

/** The account of `email`; created (invited, no usable password) when it does not exist yet. */
export async function ensureAccount(
	person: { name: string; email: string },
	tx: Prisma.TransactionClient
): Promise<{ userId: string; created: boolean }> {
	const email = person.email.trim().toLowerCase();
	const existing = await userRepo.findUserByEmail(email, tx);
	if (existing) return { userId: existing.id, created: false };

	const unusable = randomBytes(32).toString('base64url');
	const passwordHash = await (await auth.$context).password.hash(unusable);
	const user = await userRepo.createUserWithPassword({ name: person.name.trim(), email, passwordHash }, tx);
	return { userId: user.id, created: true };
}

/** E-mail a new account its invitation: a single-use link to choose a password (the previous links
 *  stop working). */
export async function sendInvitation(account: { userId: string; name: string; email: string }, organizationName: string) {
	const base = hubUrl();
	if (!base) throw new HubError("L'adresse publique du hub (ORIGIN) n'est pas configurée.");
	const token = randomBytes(24).toString('base64url');
	await userRepo.createInvitationLink(account.userId, token, new Date(Date.now() + CONSOLE_INVITATION_VALID_DAYS * DAY_MS));
	await sendMail(
		consoleInvitationMail({
			to: account.email,
			name: account.name,
			hubName: hubName(),
			organizationName,
			link: `${base}/login/nouveau-mot-de-passe?token=${encodeURIComponent(token)}&invitation=1`,
			validDays: CONSOLE_INVITATION_VALID_DAYS
		})
	);
}

/** « Mot de passe oublié » of a console account: e-mail a reset link (sent by auth.ts). Always
 *  answers the same way: nobody learns whether an address has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
	await auth.api.requestPasswordReset({ body: { email: email.trim().toLowerCase() } });
}

/** Is a reset link still usable (shown before asking for the new password)? */
export const resetLinkIsValid = (token: string) => (token ? userRepo.resetLinkIsValid(token) : Promise.resolve(false));

/** Set the new password from a reset link. Every session of the account is revoked (auth.ts). */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
	try {
		await auth.api.resetPassword({ body: { token, newPassword } });
	} catch (err) {
		if (err instanceof APIError) throw new HubError('Ce lien est invalide ou a expiré.');
		throw err;
	}
}
