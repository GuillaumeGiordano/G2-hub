-- CreateEnum
CREATE TYPE "FolderLock" AS ENUM ('NONE', 'LOCKED', 'READ_ONLY');

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "lock" "FolderLock" NOT NULL DEFAULT 'NONE';

