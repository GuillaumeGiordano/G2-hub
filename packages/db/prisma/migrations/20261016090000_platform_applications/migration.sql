-- CreateEnum
CREATE TYPE "PlatformAccess" AS ENUM ('NONE', 'ALL_ADMINS', 'PER_ORGANIZATION');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "homeUrl" TEXT,
ADD COLUMN     "platformAccess" "PlatformAccess" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "OidcAccessToken" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "OidcAuthCode" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "OrganizationTool" (
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationTool_pkey" PRIMARY KEY ("organizationId","applicationId")
);

-- CreateIndex
CREATE INDEX "OrganizationTool_applicationId_idx" ON "OrganizationTool"("applicationId");

-- AddForeignKey
ALTER TABLE "OrganizationTool" ADD CONSTRAINT "OrganizationTool_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationTool" ADD CONSTRAINT "OrganizationTool_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OidcAuthCode" ADD CONSTRAINT "OidcAuthCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OidcAccessToken" ADD CONSTRAINT "OidcAccessToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

