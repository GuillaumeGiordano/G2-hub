import { randomInt } from 'node:crypto';
import type { Prisma } from '@g2-hub/db';
import { auth } from '$lib/server/auth';
import * as userRepo from '$lib/server/repositories/userRepository';

// Console accounts created by an operator (no public sign-up, no SMTP yet): a new account gets a
// random temporary password, shown ONCE to be handed over; the person changes it in « Sécurité ».

// No look-alike characters (0/O, 1/l/I) — the password is read out or copied by hand.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTemporaryPassword(length = 14): string {
	let out = '';
	for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
	return out;
}

/** The account of `email`, created with a temporary password when it does not exist yet. */
export async function ensureAccount(
	person: { name: string; email: string },
	tx: Prisma.TransactionClient
): Promise<{ userId: string; temporaryPassword: string | null }> {
	const email = person.email.trim().toLowerCase();
	const existing = await userRepo.findUserByEmail(email, tx);
	if (existing) return { userId: existing.id, temporaryPassword: null };

	const temporaryPassword = generateTemporaryPassword();
	const passwordHash = await (await auth.$context).password.hash(temporaryPassword);
	const user = await userRepo.createUserWithPassword({ name: person.name.trim(), email, passwordHash }, tx);
	return { userId: user.id, temporaryPassword };
}
