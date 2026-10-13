// Storage presentation config (client-safe): folder visibility labels and naming rules.

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const visibilityLabel: Record<Visibility, string> = {
	PUBLIC: 'Public',
	PRIVATE: 'Privé'
};

export const visibilityVariant: Record<Visibility, 'success' | 'warning'> = {
	PUBLIC: 'success',
	PRIVATE: 'warning'
};

export const visibilityHint: Record<Visibility, string> = {
	PUBLIC: 'Lisible par tout visiteur du site (images, vidéos, PDF affichés publiquement).',
	PRIVATE: 'Jamais accessible sans un lien temporaire signé (fichiers personnels).'
};

export const visibilityOptions = VISIBILITIES.map((v) => ({ value: v, label: visibilityLabel[v] }));

/** Longest folder name accepted. */
export const FOLDER_NAME_MAX = 80;
