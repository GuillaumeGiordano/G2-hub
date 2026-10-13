import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// The .env lives at the workspace root (SvelteKit reads $env/* from kit.env.dir).
		env: { dir: '../../' },
		// The cross-site form check is done in hooks.server.ts instead (same rule, in dev too), so
		// that the OIDC token endpoint — called server-to-server by portals, with no Origin header —
		// can be exempted. Do NOT remove that check from the hook.
		csrf: { trustedOrigins: ['*'] }
	}
};

export default config;
