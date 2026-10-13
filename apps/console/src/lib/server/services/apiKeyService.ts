import { createHash, randomBytes } from 'node:crypto';
import * as keyRepo from '$lib/server/repositories/apiKeyRepository';
import { assertCan, type OrgContext } from '$lib/server/context';
import { notFound } from '$lib/server/errors';
import { API_KEY_PREFIX, type ApiKeyKind } from '$lib/records/apiKeys';
import type { ApiKeyListItem, CreatedApiKey } from '$lib/viewmodels/apiKey';
import { applicationOrThrow } from './folderService';

// API keys of an application of the ACTIVE organization (ctx from the session — §13), managed by
// its owners. A key is 32 random bytes (base64url) after its kind's prefix; only its SHA-256 is
// stored, and its full value is returned once, at creation (DECISIONS.md §19).

/** Random characters kept after the kind's prefix to recognize a key in lists (« g2_pub_8fK2xQ1z… »). */
const SHOWN_RANDOM_CHARS = 8;

export function hashKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export async function listKeys(ctx: OrgContext, applicationId: string): Promise<ApiKeyListItem[]> {
	assertCan(ctx, 'applications.manage');
	await applicationOrThrow(ctx, applicationId);
	return keyRepo.listKeys(ctx.organization.id, applicationId);
}

export async function createKey(
	ctx: OrgContext,
	applicationId: string,
	input: { name: string; kind: ApiKeyKind }
): Promise<CreatedApiKey> {
	assertCan(ctx, 'applications.manage');
	await applicationOrThrow(ctx, applicationId);
	const key = API_KEY_PREFIX[input.kind] + randomBytes(32).toString('base64url');
	await keyRepo.createKey({
		organizationId: ctx.organization.id,
		applicationId,
		kind: input.kind,
		name: input.name,
		prefix: key.slice(0, API_KEY_PREFIX[input.kind].length + SHOWN_RANDOM_CHARS),
		hash: hashKey(key),
		createdById: ctx.userId
	});
	return { name: input.name, kind: input.kind, key };
}

export async function revokeKey(ctx: OrgContext, applicationId: string, keyId: string): Promise<void> {
	assertCan(ctx, 'applications.manage');
	await applicationOrThrow(ctx, applicationId);
	if (!(await keyRepo.revokeKey(ctx.organization.id, applicationId, keyId))) throw notFound('Clé introuvable.');
}
