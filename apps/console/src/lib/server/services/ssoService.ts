import { createHash, randomBytes } from 'node:crypto';
import * as oidcRepo from '$lib/server/repositories/oidcRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { notFound } from '$lib/server/errors';
import { SSO_SECRET_PREFIX } from '$lib/records/sso';
import type { SsoSettings } from '$lib/viewmodels/sso';
import { issuer } from './oidcService';

// « Se connecter avec G2 Hub » settings of an application of the ACTIVE organization (ctx from the
// session — §13), managed by its owners (DECISIONS.md §25). Turning sign-in on = creating a client
// secret: 32 random bytes, only its SHA-256 stored, its full value returned ONCE (like API keys).

/** Random characters kept after the prefix to recognize a secret (« g2_sso_8fK2xQ1z… »). */
const SHOWN_RANDOM_CHARS = 8;

async function settingsOrThrow(ctx: OrgContext, applicationId: string) {
	assertCan(ctx, 'applications.manage');
	const app = await oidcRepo.findSsoSettings(ctx.organization.id, applicationId);
	if (!app) throw notFound('Application introuvable.');
	return app;
}

export async function getSso(ctx: OrgContext, applicationId: string): Promise<SsoSettings> {
	const app = await settingsOrThrow(ctx, applicationId);
	return {
		application: { id: app.id, name: app.name, platformAccess: app.platformAccess },
		enabled: app.ssoSecretHash !== null,
		clientId: app.id,
		secretPrefix: app.ssoSecretPrefix,
		redirectUris: app.ssoRedirectUris,
		issuer: issuer()
	};
}

/** Turn sign-in on, or replace the secret (the previous one stops working at once). */
export async function createSecret(ctx: OrgContext, applicationId: string): Promise<string> {
	const app = await settingsOrThrow(ctx, applicationId);
	const secret = SSO_SECRET_PREFIX + randomBytes(32).toString('base64url');
	await oidcRepo.updateSsoSettings(ctx.organization.id, app.id, {
		ssoSecretHash: createHash('sha256').update(secret).digest('hex'),
		ssoSecretPrefix: secret.slice(0, SSO_SECRET_PREFIX.length + SHOWN_RANDOM_CHARS)
	});
	return secret;
}

export async function updateRedirectUris(ctx: OrgContext, applicationId: string, redirectUris: string[]): Promise<void> {
	const app = await settingsOrThrow(ctx, applicationId);
	await oidcRepo.updateSsoSettings(ctx.organization.id, app.id, { ssoRedirectUris: redirectUris });
}

/** Turn sign-in off: the secret is erased, codes and access tokens already issued are revoked. */
export async function disableSso(ctx: OrgContext, applicationId: string): Promise<void> {
	const app = await settingsOrThrow(ctx, applicationId);
	await oidcRepo.updateSsoSettings(ctx.organization.id, app.id, { ssoSecretHash: null, ssoSecretPrefix: null });
	await oidcRepo.revokeApplicationGrants(app.id);
}
