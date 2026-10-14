-- A site pins the files it uses: a pinned file cannot be deleted (DECISIONS.md §23).
-- CreateTable
CREATE TABLE "FilePin" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilePin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FilePin_fileId_ref_key" ON "FilePin"("fileId", "ref");

-- AddForeignKey
ALTER TABLE "FilePin" ADD CONSTRAINT "FilePin_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

