// API key presentation config (client-safe). DECISIONS.md §19.

export const API_KEY_KINDS = ['PUBLISHABLE', 'SECRET'] as const;
export type ApiKeyKind = (typeof API_KEY_KINDS)[number];

/** Every key starts with its kind's prefix: a leaked key is recognizable at a glance. */
export const API_KEY_PREFIX: Record<ApiKeyKind, string> = {
	PUBLISHABLE: 'g2_pub_',
	SECRET: 'g2_sec_'
};

export const apiKeyKindLabel: Record<ApiKeyKind, string> = {
	PUBLISHABLE: 'Publique',
	SECRET: 'Secrète'
};

export const apiKeyKindVariant: Record<ApiKeyKind, 'success' | 'danger'> = {
	PUBLISHABLE: 'success',
	SECRET: 'danger'
};

export const apiKeyKindHint: Record<ApiKeyKind, string> = {
	PUBLISHABLE:
		'Lecture seule des dossiers publics. Peut être utilisée dans le code d’un site (navigateur), depuis ses origines autorisées.',
	SECRET:
		'Accès complet (fichiers privés compris). Uniquement côté serveur : refusée si elle est envoyée par un navigateur.'
};

export const apiKeyKindOptions = API_KEY_KINDS.map((k) => ({ value: k, label: apiKeyKindLabel[k] }));
