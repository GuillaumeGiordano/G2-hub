// Install an instance: create the first superadmin. Public sign-up is disabled in the console,
// so this one-off instance of Better Auth enables it on purpose.
//
// Usage (from the repo root), after `pnpm db:deploy`:
//   pnpm hub:install                                   # ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from .env
//   pnpm hub:install you@example.fr Secret123 "Prénom Nom"
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient, PrismaPg } from '@g2-hub/db';

// This file lives at apps/console/scripts/install.ts — the root .env is three levels up.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const [, , emailArg, passwordArg, ...nameParts] = process.argv;
const email = emailArg ?? process.env.ADMIN_EMAIL;
const password = passwordArg ?? process.env.ADMIN_PASSWORD;
const name = nameParts.join(' ') || process.env.ADMIN_NAME || 'Super Admin';

if (!email || !password) {
	console.error('Missing ADMIN_EMAIL / ADMIN_PASSWORD (in .env or as arguments).');
	process.exit(1);
}

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});
const auth = betterAuth({
	baseURL: process.env.ORIGIN || 'http://localhost:5180',
	secret: process.env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	emailAndPassword: { enabled: true } // sign-up enabled only for this bootstrap
});

try {
	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		await prisma.user.update({ where: { email }, data: { role: 'superadmin' } });
		console.log(`${email} already existed → role set to superadmin.`);
	} else {
		await auth.api.signUpEmail({ body: { email, password, name } });
		await prisma.user.update({ where: { email }, data: { role: 'superadmin', emailVerified: true } });
		console.log(`Created superadmin ${email} — change the password and set up 2FA at first login.`);
	}
} finally {
	await prisma.$disconnect();
}
