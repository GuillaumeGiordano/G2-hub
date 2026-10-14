/**
 * Where to go after signing in: `redirectTo` if it is a path of THIS site, else `/`. A bare
 * `startsWith('/')` is not enough: browsers read `//evil.example` and `/\evil.example` as another
 * site (an open redirect).
 */
export function safeRedirect(to: string | null): string {
	if (!to || !to.startsWith('/') || to.startsWith('//') || to.startsWith('/\\')) return '/';
	return to;
}
