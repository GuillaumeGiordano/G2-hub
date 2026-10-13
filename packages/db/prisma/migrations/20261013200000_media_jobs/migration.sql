-- CreateEnum
CREATE TYPE "MediaJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "MediaJob" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "MediaJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MediaJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaJob_status_createdAt_idx" ON "MediaJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaJob" ADD CONSTRAINT "MediaJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

