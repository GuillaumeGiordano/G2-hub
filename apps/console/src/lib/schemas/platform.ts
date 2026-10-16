import { z } from 'zod';
import { checkbox, optionalString, requiredString } from '$lib/validation';
import { PLATFORM_ACCESSES } from '$lib/records/platform';

// Applications of the platform (superadmin, DECISIONS.md §38) — server action + browser.

/** Where the « Outils » launcher opens an application: https (http only on this machine). */
function isHomeUrl(value: string): boolean {
	try {
		const url = new URL(value);
		const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
		return (url.protocol === 'https:' || (url.protocol === 'http:' && local)) && value.length <= 2048;
	} catch {
		return false;
	}
}

export const platformSettingsSchema = z.object({
	platformAccess: z.enum(PLATFORM_ACCESSES),
	homeUrl: optionalString().refine(
		(v) => v === undefined || isHomeUrl(v),
		'Adresse invalide : https://outil.fr (http seulement en local)'
	)
});

export const toolToggleSchema = z.object({ applicationId: requiredString(), enabled: checkbox() });
