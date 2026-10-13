-- CreateEnum
CREATE TYPE "FileSource" AS ENUM ('CONSOLE', 'API');

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "alt" TEXT,
ADD COLUMN     "apiKeyId" TEXT,
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "source" "FileSource" NOT NULL DEFAULT 'CONSOLE';

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

