import { z } from 'zod';
import { jsonField } from '$lib/validation';
import { MAX_REDIRECT_URIS } from '$lib/records/sso';

// « Se connecter avec G2 Hub » settings of an application (owner) — server action + browser.

/** A sign-in return URL: https (http only on this machine, for development), no fragment. The
 *  hub compares it EXACTLY with the one a portal sends — no prefix or wildcard matching. */
function isRedirectUri(value: string): boolean {
	try {
		const url = new URL(value);
		const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
		return (url.protocol === 'https:' || (url.protocol === 'http:' && local)) && !url.hash && value.length <= 2048;
	} catch {
		return false;
	}
}

const redirectUri = z
	.string()
	.trim()
	.refine(isRedirectUri, 'Adresse invalide : https://monportail.fr/auth/callback (http seulement en local)');

export const ssoRedirectsSchema = z.object({
	// The TagInput posts its list as JSON in a hidden `redirectUris` field.
	redirectUris: jsonField(
		z
			.array(redirectUri, 'Adresses illisibles')
			.max(MAX_REDIRECT_URIS, `${MAX_REDIRECT_URIS} adresses maximum`)
			.transform((list) => [...new Set(list)])
	)
});
