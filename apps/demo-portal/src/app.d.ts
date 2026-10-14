import type { HubToken, PortalUser } from '$lib/server/sessions';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: PortalUser | null;
			/** Server-side only: never return it from a load. */
			hubToken: HubToken | null;
		}
	}
}

export {};
