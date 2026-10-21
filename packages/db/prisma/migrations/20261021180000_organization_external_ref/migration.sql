-- An organization created by g2-erp keeps its reference: creating it again returns it (DECISIONS.md §43)
ALTER TABLE "Organization" ADD COLUMN     "externalRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_externalRef_key" ON "Organization"("externalRef");
