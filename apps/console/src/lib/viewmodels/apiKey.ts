import type { ApiKeyKind } from '$lib/records/apiKeys';

/** A row of an application's API keys (the key itself is never shown again after creation). */
export type ApiKeyListItem = {
	id: string;
	name: string;
	kind: ApiKeyKind;
	/** First characters, to recognize the key. */
	prefix: string;
	lastUsedAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
};

/** A key just created: the ONLY time its full value is returned. */
export type CreatedApiKey = { name: string; kind: ApiKeyKind; key: string };
