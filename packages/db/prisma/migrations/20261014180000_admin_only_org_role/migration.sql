-- Every console member is an « Admin » (DECISIONS.md §26). EDITOR / VIEWER members are REMOVED,
-- not promoted: turning a read-only member into an Admin would grant rights nobody decided.

-- AlterEnum
BEGIN;
DELETE FROM "Membership" WHERE "role" IN ('EDITOR', 'VIEWER');
CREATE TYPE "OrgRole_new" AS ENUM ('OWNER');
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "OrgRole_new" USING ("role"::text::"OrgRole_new");
ALTER TYPE "OrgRole" RENAME TO "OrgRole_old";
ALTER TYPE "OrgRole_new" RENAME TO "OrgRole";
DROP TYPE "public"."OrgRole_old";
COMMIT;
