// Data layer of G2 Hub. This package owns the Prisma schema, migrations and generated client.
//
// It exposes the generated client CLASS and types, plus the pg driver adapter. It does NOT
// create a client instance: the console builds its own singleton with its own DATABASE_URL
// (apps/console/src/lib/server/db.ts), so connection and env handling stay in the app.
export { PrismaClient, Prisma } from './generated/client';
export { PrismaPg } from '@prisma/adapter-pg';
