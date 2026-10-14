import { fail, redirect } from '@sveltejs/kit';
import { applicationAdmin, checkAuthorizeRequest, signIn, signInAsAdmin } from '$lib/server/services/oidcService';
import type { Actions, PageServerLoad } from './$types';

// « Se connecter avec G2 Hub » — the sign-in page a portal sends its user to (§25). The form posts
// to this same URL, query string included, so the request is checked again on submit. An Admin of
// the application's organization already signed in to the console continues with that session
// (`as=admin`, §26); everyone else signs in with their account of the application.

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	// Never inside a frame (clickjacking: a hidden sign-in form under a fake page), never cached.
	setHeaders({
		'x-frame-options': 'DENY',
		'content-security-policy': "frame-ancestors 'none'",
		'cache-control': 'no-store',
		'referrer-policy': 'same-origin'
	});
	const check = await checkAuthorizeRequest(url.searchParams);
	if (check.kind === 'redirect') redirect(303, check.location);
	if (check.kind === 'fatal') {
		return { fatal: check.message, application: null, loginHint: null, admin: null, consoleSignedIn: false };
	}
	const admin = locals.user ? await applicationAdmin(check.request, locals.user.id) : null;
	return {
		fatal: null,
		application: check.request.application,
		loginHint: check.request.loginHint,
		admin,
		consoleSignedIn: !!locals.user
	};
};

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const check = await checkAuthorizeRequest(url.searchParams);
		if (check.kind === 'redirect') redirect(303, check.location);
		if (check.kind === 'fatal') return fail(400, { message: check.message, email: '' });

		const form = await request.formData();
		if (form.get('as') === 'admin') {
			if (!locals.user || !locals.session) return fail(400, { message: 'Connectez-vous d’abord à la console.', email: '' });
			const result = await signInAsAdmin(check.request, locals.user.id, locals.session.createdAt);
			if (!result.ok) return fail(400, { message: result.message, email: '' });
			redirect(303, result.location);
		}

		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		if (!email.trim() || !password) return fail(400, { message: 'Saisissez votre e-mail et votre mot de passe.', email });

		const result = await signIn(check.request, email, password);
		if (!result.ok) return fail(400, { message: result.message, email });
		redirect(303, result.location);
	}
};
