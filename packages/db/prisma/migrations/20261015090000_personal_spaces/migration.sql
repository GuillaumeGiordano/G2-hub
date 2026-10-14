-- Personal spaces of application users (DECISIONS.md §28): a folder / file owned by an AppUser.
-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "ownerAppUserId" TEXT;

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "ownerAppUserId" TEXT;

-- CreateIndex
CREATE INDEX "Folder_ownerAppUserId_idx" ON "Folder"("ownerAppUserId");

-- CreateIndex
CREATE INDEX "StoredFile_ownerAppUserId_idx" ON "StoredFile"("ownerAppUserId");

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_ownerAppUserId_fkey" FOREIGN KEY ("ownerAppUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerAppUserId_fkey" FOREIGN KEY ("ownerAppUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One PUBLIC and one PRIVATE root folder per user at most (two concurrent first uploads cannot
-- create two spaces). Partial: subfolders of a space stay possible later.
CREATE UNIQUE INDEX "Folder_owner_root_visibility_key" ON "Folder"("ownerAppUserId", "visibility")
    WHERE "ownerAppUserId" IS NOT NULL AND "parentId" IS NULL;
