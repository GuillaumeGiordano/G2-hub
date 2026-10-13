import { hubName } from '$lib/server/instance';
import type { LayoutServerLoad } from './$types';

// The instance name (from .env) is shown on every screen, including the public sign-in pages.
export const load: LayoutServerLoad = () => ({ hubName: hubName() });
