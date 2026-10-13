import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Passwords of application users (console accounts are hashed by Better Auth). scrypt is built into
// Node and deliberately slow AND memory-hungry, which makes brute-forcing a stolen hash expensive.
// The parameters travel with the hash (`scrypt$N$r$p$salt$hash`), so they can be raised later
// without breaking existing passwords.

const N = 16384; // CPU / memory cost (2^14)
const R = 8; // block size
const P = 1; // parallelism
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (err, key) =>
			err ? reject(err) : resolve(key)
		)
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(password, salt, { N, r: R, p: P });
	return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, n, r, p, salt, hash] = stored.split('$');
	if (algo !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const key = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
	// Constant-time comparison: the answer time does not reveal how many bytes matched.
	return key.length === expected.length && timingSafeEqual(key, expected);
}
