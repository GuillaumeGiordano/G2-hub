import type { PortalUser } from '$lib/server/sessions';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: PortalUser | null;
		}
	}
}

export {};
