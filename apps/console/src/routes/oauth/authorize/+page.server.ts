import { fail, redirect } from '@sveltejs/kit';
import { checkAuthorizeRequest, consoleSignIn, signIn, signInAsConsoleMember } from '$lib/server/services/oidcService';
import { clientOf } from '$lib/server/services/signInLogService';
import { signupAvailable } from '$lib/server/services/signupService';
import { isPlatformApplication } from '$lib/records/platform';
import type { Actions, PageServerLoad } from './$types';

// « Se connecter avec G2 Hub » — the sign-in page a portal sends its user to (§25). The form posts
// to this same URL, query string included, so the request is checked again on submit. A console
// member already signed in who may enter the application — an Admin of its organization (§26), or
// of any organization on an application of the platform (§38) — continues with that session
// (`as=admin`, plus `organization` for a tool); everyone else signs in with their account of the
// application. An application of the platform has no such accounts: console sign-in only, plus
// « Créer un compte » on the portal when the instance allows it (§45).

/** The sign-up page, coming back to this same request (without `prompt`, or it would loop). */
function signupPath(url: URL): string {
	const params = new URLSearchParams(url.searchParams);
	params.delete('prompt');
	return `/inscription?${new URLSearchParams({ returnTo: `${url.pathname}?${params}` })}`;
}

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
		return {
			fatal: check.message,
			application: null,
			platform: false,
			signupHref: null,
			loginHint: null,
			member: null,
			consoleSignedIn: false
		};
	}
	const signupHref = signupAvailable(check.request.application) ? signupPath(url) : null;
	// OpenID Connect « Initiating User Registration »: the portal asks for the sign-up directly.
	if (signupHref && !locals.user && (url.searchParams.get('prompt') ?? '').split(' ').includes('create')) redirect(303, signupHref);
	const member = locals.user ? await consoleSignIn(check.request, locals.user.id) : null;
	const { id, name, platformAccess } = check.request.application;
	return {
		fatal: null,
		application: { id, name },
		platform: isPlatformApplication(platformAccess),
		signupHref,
		loginHint: check.request.loginHint,
		member,
		consoleSignedIn: !!locals.user
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, url, locals } = event;
		const check = await checkAuthorizeRequest(url.searchParams);
		if (check.kind === 'redirect') redirect(303, check.location);
		if (check.kind === 'fatal') return fail(400, { message: check.message, email: '' });

		const form = await request.formData();
		if (form.get('as') === 'admin') {
			if (!locals.user || !locals.session) return fail(400, { message: 'Connectez-vous d’abord à la console.', email: '' });
			const organizationId = String(form.get('organization') ?? '') || null;
			const result = await signInAsConsoleMember(
				check.request,
				locals.user.id,
				locals.session.createdAt,
				organizationId,
				clientOf(event)
			);
			if (!result.ok) return fail(400, { message: result.message, email: '' });
			redirect(303, result.location);
		}

		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		if (!email.trim() || !password) return fail(400, { message: 'Saisissez votre e-mail et votre mot de passe.', email });

		const result = await signIn(check.request, email, password, clientOf(event));
		if (!result.ok) return fail(400, { message: result.message, email });
		redirect(303, result.location);
	}
};
