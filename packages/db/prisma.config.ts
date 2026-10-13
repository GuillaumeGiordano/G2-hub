// Prisma 7 configuration. Reads DATABASE_URL from the workspace-root .env.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

// This file lives at packages/db/prisma.config.ts — the root .env is two levels up.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		url: process.env['DATABASE_URL']
	}
});
