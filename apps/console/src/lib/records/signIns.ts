// Sign-in log of an application (client-safe): labels and filters (DECISIONS.md §40).

export const SIGN_IN_OUTCOMES = [
	'SUCCESS',
	'WRONG_PASSWORD',
	'UNKNOWN_ACCOUNT',
	'NOT_ACTIVATED',
	'DISABLED',
	'TOO_MANY_ATTEMPTS',
	'PASSWORD_SET',
	'PASSWORD_RESET'
] as const;
export type SignInOutcome = (typeof SIGN_IN_OUTCOMES)[number];

export const signInOutcomeLabel: Record<SignInOutcome, string> = {
	SUCCESS: 'Réussie',
	WRONG_PASSWORD: 'Mot de passe incorrect',
	UNKNOWN_ACCOUNT: 'Adresse inconnue',
	NOT_ACTIVATED: 'Compte pas encore activé',
	DISABLED: 'Compte désactivé',
	TOO_MANY_ATTEMPTS: 'Trop de tentatives',
	PASSWORD_SET: 'Mot de passe choisi',
	PASSWORD_RESET: 'Mot de passe réinitialisé'
};

export const signInOutcomeVariant: Record<SignInOutcome, 'success' | 'danger' | 'warning' | 'info'> = {
	SUCCESS: 'success',
	WRONG_PASSWORD: 'danger',
	UNKNOWN_ACCOUNT: 'danger',
	NOT_ACTIVATED: 'warning',
	DISABLED: 'warning',
	TOO_MANY_ATTEMPTS: 'danger',
	PASSWORD_SET: 'info',
	PASSWORD_RESET: 'info'
};

/** The outcomes that are a refused sign-in. */
export const FAILED_OUTCOMES: readonly SignInOutcome[] = [
	'WRONG_PASSWORD',
	'UNKNOWN_ACCOUNT',
	'NOT_ACTIVATED',
	'DISABLED',
	'TOO_MANY_ATTEMPTS'
];

export const SIGN_IN_METHODS = ['PASSWORD', 'CONSOLE_SESSION', 'EMAIL_LINK'] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

export const signInMethodLabel: Record<SignInMethod, string> = {
	PASSWORD: 'Mot de passe',
	CONSOLE_SESSION: 'Session console (admin)',
	EMAIL_LINK: 'Lien par e-mail'
};

/** The « Résultat » filter of the log. */
export const SIGN_IN_FILTERS = ['all', 'success', 'failed'] as const;
export type SignInFilter = (typeof SIGN_IN_FILTERS)[number];

export const signInFilterOptions: { value: SignInFilter; label: string }[] = [
	{ value: 'all', label: 'Toutes' },
	{ value: 'success', label: 'Réussies' },
	{ value: 'failed', label: 'Échouées' }
];

/** Events older than this are deleted by the worker (the IP address is personal data). */
export const SIGN_IN_RETENTION_DAYS = 183;
