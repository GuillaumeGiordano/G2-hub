import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@g2-hub/db';
import { prisma } from '$lib/server/db';
import * as userRepo from '$lib/server/repositories/appUserRepository';
import * as platformRepo from '$lib/server/repositories/platformRepository';
import * as fileRepo from '$lib/server/repositories/fileRepository';
import { purgeObjects } from '$lib/server/storage/purge';
import { appUserStatus, toAppUserListItem } from '$lib/server/mappers/appUserMapper';
import { assertCan, type OrgContext } from '$lib/server/context';
import { forbidden, HubError, notFound } from '$lib/server/errors';
import { hubUrl } from '$lib/server/instance';
import { sendMail } from '$lib/server/mail/mailer';
import { invitationMail, passwordResetMail } from '$lib/server/mail/templates';
import { hashPassword } from '$lib/server/passwords';
import {
	ACTIVE_USER_DAYS,
	INVITATION_VALID_DAYS,
	PASSWORD_RESET_VALID_MINUTES,
	type AppUserRole,
	type AppUserStatus
} from '$lib/records/appUsers';
import { isPlatformApplication } from '$lib/records/platform';
import type { AppUserListItem, AppUserUsage, PasswordLink } from '$lib/viewmodels/appUser';
import type { SignInClient } from '$lib/viewmodels/signIn';
import { recordSignIn } from './signInLogService';
import { allowHit, RESET_PER_IP } from '$lib/server/rateLimit';
import { applicationOrThrow } from './folderService';

// Application users — the people who sign in to a client's PORTAL (DECISIONS.md §24). Their account
// lives in ONE application (the same e-mail may have accounts in two applications) and can never
// open the console. Created by invitation: an e-mailed single-use link to choose a password. Links
// are 32 random bytes; only their SHA-256 is stored (a leaked database gives no usable link).

const DAY_MS = 24 * 3600_000;
/** « Mot de passe oublié » sends at most one e-mail per user in this window. */
const RESET_THROTTLE_MS = 2 * 60_000;
const INVALID_LINK = 'Ce lien est invalide ou a expiré.';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** A new single-use link: the token goes in the e-mail, its hash in the database. */
function newLink(): { url: string; hash: string } {
	const base = hubUrl();
	if (!base) throw new HubError("L'adresse publique du hub (ORIGIN) n'est pas configurée.");
	const token = randomBytes(32).toString('base64url');
	return { url: `${base}/mot-de-passe/${token}`, hash: sha256(token) };
}

type InviteScope = {
	organizationId: string;
	applicationId: string;
	applicationName: string;
	invitedById: string | null;
};

export type InvitedAppUser = { id: string; name: string; email: string; role: AppUserRole; status: AppUserStatus };

type InviteInput = { name: string; email: string; role: AppUserRole };

/**
 * Create the account and e-mail its invitation. Shared by the console and the API. If the e-mail
 * cannot be sent, the account is removed again: an invitation nobody received helps no one.
 */
export async function invite(scope: InviteScope, input: InviteInput): Promise<InvitedAppUser> {
	// The portal and the tools are entered with a console account, never with application users (§45).
	const platform = await platformRepo.findPlatformSettings(scope.organizationId, scope.applicationId);
	if (platform && isPlatformApplication(platform.platformAccess)) {
		throw new HubError("Une application de la plateforme n'a pas d'utilisateurs : on s'y connecte avec un compte de la console.");
	}
	const email = normalizeEmail(input.email);
	const existing = await userRepo.findAppUserByEmail(scope.applicationId, email);
	if (existing) throw alreadyThere(existing.passwordHash !== null);
	// The Auth offer's limit, all applications of the organization together (§39). Two invitations
	// at the same instant may both pass: a limit of the plan, not a security boundary.
	const allowance = await userRepo.findUserAllowance(scope.organizationId);
	if (allowance && allowance.count >= allowance.max) {
		throw new HubError(
			`Limite atteinte : ${allowance.max} utilisateurs pour cette organisation. Supprimez des comptes ou contactez votre prestataire.`,
			{ field: 'email', status: 409 }
		);
	}

	const link = newLink();
	let id: string;
	try {
		id = await prisma.$transaction(async (tx) => {
			const user = await userRepo.createAppUser(
				{
					organizationId: scope.organizationId,
					applicationId: scope.applicationId,
					email,
					name: input.name,
					role: input.role,
					invitedById: scope.invitedById
				},
				tx
			);
			await userRepo.createToken(
				{ appUserId: user.id, purpose: 'INVITATION', hash: link.hash, expiresAt: new Date(Date.now() + INVITATION_VALID_DAYS * DAY_MS) },
				tx
			);
			return user.id;
		});
	} catch (err) {
		// Two simultaneous invitations of the same address: the unique index decides.
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw alreadyThere(false);
		throw err;
	}

	try {
		await sendMail(
			invitationMail({ to: email, name: input.name, applicationName: scope.applicationName, link: link.url, validDays: INVITATION_VALID_DAYS })
		);
	} catch (err) {
		await userRepo.deleteAppUser(scope.organizationId, scope.applicationId, id);
		throw err;
	}
	return { id, name: input.name, email, role: input.role, status: 'INVITED' };
}

function alreadyThere(active: boolean) {
	return new HubError(
		active ? 'Cette adresse a déjà un compte dans cette application.' : "Déjà invitée : utilisez « Renvoyer l'invitation ».",
		{ field: 'email' }
	);
}

// ─── Console (active organization, ctx from the session — §13) ───────────────

/** The users of the applications belong to the Auth offer (§12). */
function assertAuthEnabled(ctx: OrgContext): void {
	if (!ctx.organization.authEnabled) throw forbidden("L'offre Auth n'est pas activée pour cette organisation.");
}

export async function listAppUsers(
	ctx: OrgContext,
	applicationId: string,
	params: { search?: string; page: number; perPage: number }
): Promise<{ items: AppUserListItem[]; total: number }> {
	assertCan(ctx, 'read');
	assertAuthEnabled(ctx);
	const app = await applicationOrThrow(ctx, applicationId);
	if (isPlatformApplication(app.platformAccess)) throw notFound('Application introuvable.');
	const [rows, total] = await Promise.all([
		userRepo.searchAppUsers({
			organizationId: ctx.organization.id,
			applicationId,
			search: params.search,
			skip: (params.page - 1) * params.perPage,
			take: params.perPage
		}),
		userRepo.countAppUsers(ctx.organization.id, applicationId, params.search)
	]);
	// How much each personal space holds (§28) — the console never shows their content.
	const usage = await fileRepo.personalUsageByUser(ctx.organization.id, rows.map((r) => r.id));
	const now = new Date();
	return { items: rows.map((r) => toAppUserListItem(r, usage.get(r.id), now)), total };
}

/** The organization's users against its limit, and how many are active (dashboard, §39). */
export async function usage(ctx: OrgContext): Promise<AppUserUsage | null> {
	assertCan(ctx, 'read');
	if (!ctx.organization.authEnabled) return null;
	const since = new Date(Date.now() - ACTIVE_USER_DAYS * DAY_MS);
	const [allowance, active] = await Promise.all([
		userRepo.findUserAllowance(ctx.organization.id),
		userRepo.countActiveAppUsers(ctx.organization.id, since)
	]);
	return allowance ? { total: allowance.count, max: allowance.max, active } : null;
}

export async function inviteAppUser(ctx: OrgContext, applicationId: string, input: InviteInput) {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	const app = await applicationOrThrow(ctx, applicationId);
	return invite(
		{ organizationId: ctx.organization.id, applicationId, applicationName: app.name, invitedById: ctx.userId },
		input
	);
}

/** A user of THIS application of THIS organization, or 404. */
async function appUserOrThrow(ctx: OrgContext, applicationId: string, id: string) {
	const user = await userRepo.findAppUser(ctx.organization.id, id);
	if (!user || user.applicationId !== applicationId) throw notFound('Utilisateur introuvable.');
	return user;
}

/** A new invitation link (the previous ones stop working). Returns the address it went to. */
export async function resendInvitation(ctx: OrgContext, applicationId: string, id: string): Promise<string> {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	const app = await applicationOrThrow(ctx, applicationId);
	const user = await appUserOrThrow(ctx, applicationId, id);
	const status = appUserStatus(user);
	if (status === 'DISABLED') throw new HubError("Ce compte est désactivé : réactivez-le d'abord.");
	if (status === 'ACTIVE') throw new HubError('Ce compte est déjà activé.');

	const link = newLink();
	await prisma.$transaction(async (tx) => {
		await userRepo.revokeTokens(user.id, 'INVITATION', tx);
		await userRepo.createToken(
			{ appUserId: user.id, purpose: 'INVITATION', hash: link.hash, expiresAt: new Date(Date.now() + INVITATION_VALID_DAYS * DAY_MS) },
			tx
		);
	});
	await sendMail(
		invitationMail({ to: user.email, name: user.name, applicationName: app.name, link: link.url, validDays: INVITATION_VALID_DAYS })
	);
	return user.email;
}

/** Disable (sign-in, links and access tokens refused; the account and its files are kept) or re-enable. */
export async function setAppUserDisabled(
	ctx: OrgContext,
	applicationId: string,
	id: string,
	disabled: boolean
): Promise<string> {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	await applicationOrThrow(ctx, applicationId);
	const user = await appUserOrThrow(ctx, applicationId, id);
	await userRepo.setDisabled(ctx.organization.id, applicationId, user.id, disabled ? new Date() : null);
	if (disabled) {
		await userRepo.revokeTokens(user.id);
		await userRepo.revokeGrants(user.id);
	}
	return user.email;
}

/**
 * Edit the account: name, e-mail, role. A new e-mail or role revokes the codes and access tokens
 * already issued: they carry the former claims for up to an hour (the portal then asks the user to
 * sign in again). A pending invitation went to the former address: it stops working, and the
 * console offers to send it again.
 */
export async function updateAppUser(
	ctx: OrgContext,
	applicationId: string,
	id: string,
	input: { name: string; email: string; role: AppUserRole }
): Promise<{ email: string; invitationRevoked: boolean }> {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	await applicationOrThrow(ctx, applicationId);
	const user = await appUserOrThrow(ctx, applicationId, id);
	const email = normalizeEmail(input.email);
	const emailChanged = email !== user.email;
	try {
		await userRepo.updateAppUser(ctx.organization.id, applicationId, user.id, { name: input.name, email, role: input.role });
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
			throw new HubError('Cette adresse a déjà un compte dans cette application.', { field: 'email' });
		}
		throw err;
	}
	if (emailChanged || input.role !== user.role) await userRepo.revokeGrants(user.id);
	const invitationRevoked = emailChanged && appUserStatus(user) === 'INVITED';
	if (invitationRevoked) await userRepo.revokeTokens(user.id, 'INVITATION');
	return { email, invitationRevoked };
}

/** « Révoquer les sessions »: every sign-in code and access token stops working at once. The hub
 *  keeps no portal session of its own: the portal gets a 401 and signs the user in again. */
export async function revokeAppUserSessions(ctx: OrgContext, applicationId: string, id: string): Promise<string> {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	await applicationOrThrow(ctx, applicationId);
	const user = await appUserOrThrow(ctx, applicationId, id);
	await userRepo.revokeGrants(user.id);
	return user.email;
}

/** « Réinitialiser le mot de passe »: e-mail the user a link to choose a new one. The Admin never
 *  sees nor sets a password; the current one keeps working until the user uses the link. */
export async function sendAppUserPasswordReset(ctx: OrgContext, applicationId: string, id: string): Promise<string> {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	const app = await applicationOrThrow(ctx, applicationId);
	const user = await appUserOrThrow(ctx, applicationId, id);
	const status = appUserStatus(user);
	if (status === 'DISABLED') throw new HubError("Ce compte est désactivé : réactivez-le d'abord.");
	if (status === 'INVITED') throw new HubError("Pas encore de mot de passe : utilisez « Renvoyer l'invitation ».");
	if (await userRepo.sentTokenSince(user.id, 'PASSWORD_RESET', new Date(Date.now() - RESET_THROTTLE_MS))) {
		throw new HubError('Un lien vient déjà de lui être envoyé : réessayez dans 2 minutes.');
	}
	await sendPasswordResetLink(user, app.name);
	return user.email;
}

/** A new reset link (the previous ones stop working), e-mailed. */
async function sendPasswordResetLink(user: { id: string; name: string; email: string }, applicationName: string) {
	const link = newLink();
	await prisma.$transaction(async (tx) => {
		await userRepo.revokeTokens(user.id, 'PASSWORD_RESET', tx);
		await userRepo.createToken(
			{ appUserId: user.id, purpose: 'PASSWORD_RESET', hash: link.hash, expiresAt: new Date(Date.now() + PASSWORD_RESET_VALID_MINUTES * 60_000) },
			tx
		);
	});
	await sendMail(
		passwordResetMail({ to: user.email, name: user.name, applicationName, link: link.url, validMinutes: PASSWORD_RESET_VALID_MINUTES })
	);
}

export async function deleteAppUser(ctx: OrgContext, applicationId: string, id: string): Promise<string> {
	assertCan(ctx, 'appUsers.manage');
	assertAuthEnabled(ctx);
	await applicationOrThrow(ctx, applicationId);
	const user = await appUserOrThrow(ctx, applicationId, id);
	// The personal space's objects first (§28): the rows then go by cascade, freeing their bytes.
	await purgeObjects(await fileRepo.listOwnedFilesForPurge(ctx.organization.id, user.id));
	await userRepo.deleteAppUser(ctx.organization.id, applicationId, user.id);
	return user.email;
}

// ─── Public pages (the user, from an e-mailed link) ──────────────────────────

/** The link behind `token` if it can still be used, else null. */
async function usableLink(token: string) {
	if (!token || token.length > 128) return null;
	const row = await userRepo.findTokenByHash(sha256(token));
	if (!row || row.usedAt || row.expiresAt <= new Date() || row.appUser.disabledAt) return null;
	return row;
}

export async function passwordLink(token: string): Promise<PasswordLink | null> {
	const row = await usableLink(token);
	if (!row) return null;
	return {
		purpose: row.purpose,
		name: row.appUser.name,
		email: row.appUser.email,
		applicationName: row.appUser.application.name
	};
}

/** Set the password from an invitation or reset link (which then stops working). */
export async function choosePassword(
	token: string,
	password: string,
	client: SignInClient
): Promise<{ applicationName: string }> {
	const row = await usableLink(token);
	if (!row) throw new HubError(INVALID_LINK);
	const used = await userRepo.useTokenAndSetPassword(row.id, row.appUser.id, await hashPassword(password));
	if (!used) throw new HubError(INVALID_LINK);
	recordSignIn({
		organizationId: row.appUser.organizationId,
		applicationId: row.appUser.applicationId,
		appUserId: row.appUser.id,
		email: row.appUser.email,
		outcome: row.purpose === 'INVITATION' ? 'PASSWORD_SET' : 'PASSWORD_RESET',
		method: 'EMAIL_LINK',
		client
	});
	return { applicationName: row.appUser.application.name };
}

/** The application of the « mot de passe oublié » page, or 404. */
export async function publicApplication(applicationId: string): Promise<{ id: string; name: string }> {
	const app = await userRepo.findApplicationName(applicationId);
	if (!app) throw notFound('Application introuvable.');
	return app;
}

/**
 * « Mot de passe oublié ». Always answers the same way, whether the address has an account or not,
 * and sends in the background: neither the answer nor its timing reveals who is registered.
 */
export async function requestPasswordReset(applicationId: string, email: string, client: SignInClient): Promise<void> {
	const app = await publicApplication(applicationId);
	// Per IP address (§41): no flood of reset e-mails. Silent, like every other refusal here.
	if (!allowHit(client.ipAddress && `reset:${client.ipAddress}`, RESET_PER_IP.max, RESET_PER_IP.windowMs)) return;
	const user = await userRepo.findAppUserByEmail(app.id, normalizeEmail(email));
	if (!user || appUserStatus(user) !== 'ACTIVE') return;
	if (await userRepo.sentTokenSince(user.id, 'PASSWORD_RESET', new Date(Date.now() - RESET_THROTTLE_MS))) return;
	sendPasswordResetLink(user, app.name).catch(() => {}); // already logged by the mailer; the user can ask again
}
