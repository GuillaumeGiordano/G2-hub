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

// ─── Folder locks (DECISIONS.md §37) ───────────────────────────────────────────

/** What an Admin may do with a folder the site relies on. The superadmin is never restricted. */
export const FOLDER_LOCKS = ['NONE', 'LOCKED', 'READ_ONLY'] as const;
export type FolderLock = (typeof FOLDER_LOCKS)[number];

export const folderLockLabel: Record<FolderLock, string> = {
	NONE: 'Libre',
	LOCKED: 'Verrouillé',
	READ_ONLY: 'Lecture seule'
};

/** Shown to the superadmin when choosing, and to the Admin inside the folder. */
export const folderLockHint: Record<FolderLock, string> = {
	NONE: "L'admin peut le renommer, le supprimer et gérer ses fichiers.",
	LOCKED: "Utilisé par le site : l'admin ne peut ni le renommer ni le supprimer, mais gère ses fichiers.",
	READ_ONLY: "Contenu fourni : l'admin consulte seulement (ni fichiers, ni sous-dossiers, ni renommage)."
};

export const folderLockOptions = FOLDER_LOCKS.map((l) => ({ value: l, label: folderLockLabel[l], hint: folderLockHint[l] }));

export const folderLockVariant: Record<FolderLock, 'default' | 'warning' | 'danger'> = {
	NONE: 'default',
	LOCKED: 'warning',
	READ_ONLY: 'danger'
};
