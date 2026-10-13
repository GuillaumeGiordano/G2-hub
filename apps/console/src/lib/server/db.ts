import { PrismaClient, PrismaPg } from '@g2-hub/db';
import { env } from '$env/dynamic/private';

// The console's Prisma client singleton, built from the @g2-hub/db class. DATABASE_URL is read at
// runtime (dynamic env). Reused across HMR reloads in dev.
const createClient = () =>
	new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (import.meta.env.DEV) globalForPrisma.prisma = prisma;
