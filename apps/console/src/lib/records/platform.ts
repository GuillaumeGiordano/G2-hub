// Applications of the platform (client-safe): who outside an application's organization may sign
// in to it with their console session (DECISIONS.md §38).

export const PLATFORM_ACCESSES = ['NONE', 'ALL_ADMINS', 'PER_ORGANIZATION'] as const;
export type PlatformAccess = (typeof PLATFORM_ACCESSES)[number];

/** An application of the platform (portal or tool): entered with a console account, never with
 *  application users (DECISIONS.md §45). */
export const isPlatformApplication = (access: PlatformAccess): boolean => access !== 'NONE';

export const platformAccessLabel: Record<PlatformAccess, string> = {
	NONE: 'Application du client',
	ALL_ADMINS: 'Portail de la plateforme',
	PER_ORGANIZATION: 'Outil de la plateforme'
};

export const platformAccessHint: Record<PlatformAccess, string> = {
	NONE: 'Seuls les admins de son organisation s’y connectent avec leur compte console.',
	ALL_ADMINS: 'Tout admin de n’importe quelle organisation s’y connecte (rôle « client »), au niveau de son compte.',
	PER_ORGANIZATION: 'Un admin s’y connecte POUR une organisation, si l’outil est activé pour elle.'
};

export const platformAccessOptions = PLATFORM_ACCESSES.map((a) => ({
	value: a,
	label: platformAccessLabel[a],
	hint: platformAccessHint[a]
}));
