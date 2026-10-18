// A small fixed-window rate limiter, in memory (one process per instance, like the per-address
// limit of oidcService). Used against password spraying and e-mail flooding from one IP address
// (DECISIONS.md §41): the per-address limit alone lets an attacker try one password on thousands of
// addresses.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Beyond this many keys, expired buckets are swept (an attacker rotating keys cannot grow it). */
const SWEEP_ABOVE = 10_000;

function sweep(now: number): void {
	for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

/**
 * Count one hit on `key`; false once `max` hits happened within `windowMs`. A null key (the client
 * address is unknown, e.g. no proxy header) is never limited here: a shared bucket would let one
 * attacker lock everyone out.
 */
export function allowHit(key: string | null, max: number, windowMs: number): boolean {
	if (!key) return true;
	const now = Date.now();
	if (buckets.size > SWEEP_ABOVE) sweep(now);
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	bucket.count++;
	return bucket.count <= max;
}

/** Sign-in attempts to an application from one IP address. */
export const SIGN_IN_PER_IP = { max: 20, windowMs: 5 * 60_000 };
/** « Mot de passe oublié » requests from one IP address. */
export const RESET_PER_IP = { max: 5, windowMs: 15 * 60_000 };
