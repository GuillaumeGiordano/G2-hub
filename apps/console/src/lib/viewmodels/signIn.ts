import type { SignInMethod, SignInOutcome } from '$lib/records/signIns';

/** A line of an application's sign-in log (§40). */
export type SignInEventItem = {
	id: string;
	createdAt: Date;
	/** The account's name when known (an application user, or a console member). */
	name: string | null;
	email: string;
	outcome: SignInOutcome;
	method: SignInMethod;
	ipAddress: string | null;
	/** « Chrome · Windows », from the User-Agent. */
	device: string | null;
};

/** Where a sign-in comes from: read from the request by the route, stored as is. */
export type SignInClient = { ipAddress: string | null; userAgent: string | null };
