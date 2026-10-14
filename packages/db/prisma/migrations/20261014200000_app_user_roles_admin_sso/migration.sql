-- Roles of application users and « Se connecter avec G2 Hub » for organization Admins (DECISIONS.md §26).
-- CreateEnum
CREATE TYPE "AppUserRole" AS ENUM ('SUPER_USER', 'USER', 'GUEST');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN     "role" "AppUserRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "OidcAccessToken" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "appUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OidcAuthCode" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "appUserId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "OidcAccessToken_userId_idx" ON "OidcAccessToken"("userId");

-- AddForeignKey
ALTER TABLE "OidcAuthCode" ADD CONSTRAINT "OidcAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OidcAccessToken" ADD CONSTRAINT "OidcAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A code / token belongs to EXACTLY ONE holder: an application user OR a console member (not
-- expressible in the Prisma schema).
ALTER TABLE "OidcAuthCode" ADD CONSTRAINT "OidcAuthCode_one_holder" CHECK (num_nonnulls("appUserId", "userId") = 1);
ALTER TABLE "OidcAccessToken" ADD CONSTRAINT "OidcAccessToken_one_holder" CHECK (num_nonnulls("appUserId", "userId") = 1);
