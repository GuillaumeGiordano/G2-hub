import { fail, redirect } from '@sveltejs/kit';
import { checkAuthorizeRequest, signIn } from '$lib/server/services/oidcService';
import type { Actions, PageServerLoad } from './$types';

// « Se connecter avec G2 Hub » — the sign-in page a portal sends its user to (§25). The form posts
// to this same URL, query string included, so the request is checked again on submit.

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	// Never inside a frame (clickjacking: a hidden sign-in form under a fake page), never cached.
	setHeaders({
		'x-frame-options': 'DENY',
		'content-security-policy': "frame-ancestors 'none'",
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer'
	});
	const check = await checkAuthorizeRequest(url.searchParams);
	if (check.kind === 'redirect') redirect(303, check.location);
	if (check.kind === 'fatal') return { fatal: check.message, application: null, loginHint: null };
	return { fatal: null, application: check.request.application, loginHint: check.request.loginHint };
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const check = await checkAuthorizeRequest(url.searchParams);
		if (check.kind === 'redirect') redirect(303, check.location);
		if (check.kind === 'fatal') return fail(400, { message: check.message, email: '' });

		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		if (!email.trim() || !password) return fail(400, { message: 'Saisissez votre e-mail et votre mot de passe.', email });

		const result = await signIn(check.request, email, password);
		if (!result.ok) return fail(400, { message: result.message, email });
		redirect(303, result.location);
	}
};
