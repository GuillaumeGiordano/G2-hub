-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_activeOrganizationId_fkey";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "activeOrganizationId";

