import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { CONSOLE_PASSWORD_RESET_VALID_MINUTES } from '$lib/constants';
import { prisma } from './db';
import { hubName, hubUrl } from './instance';
import { sendMail } from './mail/mailer';
import { consolePasswordResetMail } from './mail/templates';
import { countResetLinksSince } from './repositories/userRepository';

/** At most one reset e-mail per account in this window (the login page can be submitted by anyone). */
const RESET_THROTTLE_MS = 2 * 60_000;

// Console accounts. No public sign-up: the first superadmin comes from `pnpm hub:install`, the
// others are invited from the console (step 1). No email verification. A forgotten password is reset
// from an e-mailed link (§31). (Application users — portal end users — are NOT Better Auth accounts:
// see appUserService.)
export const auth = betterAuth({
	baseURL: hubUrl() || undefined,
	secret: env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, { provider: 'postgresql' }),

	user: {
		additionalFields: {
			// Instance-level role (superadmin | member) — never settable by the client.
			role: { type: 'string', defaultValue: 'member', input: false }
		}
	},

	session: {
		additionalFields: {
			// The organization the console works in — written server-side only, after checking the
			// membership (organizationService.switchOrganization / resolveActiveOrganization).
			activeOrganizationId: { type: 'string', required: false, input: false }
		}
	},

	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		minPasswordLength: 8,
		requireEmailVerification: false,
		// « Mot de passe oublié »: Better Auth creates the single-use token; the e-mail points to the
		// console's own page (/login/nouveau-mot-de-passe), which sets the password with it.
		resetPasswordTokenExpiresIn: CONSOLE_PASSWORD_RESET_VALID_MINUTES * 60,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, token }) => {
			if ((await countResetLinksSince(user.id, new Date(Date.now() - RESET_THROTTLE_MS))) > 1) return;
			await sendMail(
				consolePasswordResetMail({
					to: user.email,
					name: user.name,
					hubName: hubName(),
					link: `${hubUrl()}/login/nouveau-mot-de-passe?token=${encodeURIComponent(token)}`,
					validMinutes: CONSOLE_PASSWORD_RESET_VALID_MINUTES
				})
			);
		}
	},

	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customRules: { '/sign-in/email': { window: 60, max: 5 } }
	},

	// TOTP + backup codes. On sign-in with 2FA enabled, the client is redirected to /2fa.
	plugins: [twoFactor({ issuer: hubName() })]
});

export type SessionUser = typeof auth.$Infer.Session.user;
