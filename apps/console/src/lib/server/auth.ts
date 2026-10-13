import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { prisma } from './db';
import { hubName, hubUrl } from './instance';

// Console accounts. No public sign-up: the first superadmin comes from `pnpm hub:install`, the
// others are invited from the console (step 1). No email verification. (Application users — portal
// end users — are NOT Better Auth accounts: see appUserService.)
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
		requireEmailVerification: false
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
