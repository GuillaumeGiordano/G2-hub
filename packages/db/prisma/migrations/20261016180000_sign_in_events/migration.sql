-- CreateEnum
CREATE TYPE "SignInOutcome" AS ENUM ('SUCCESS', 'WRONG_PASSWORD', 'UNKNOWN_ACCOUNT', 'NOT_ACTIVATED', 'DISABLED', 'TOO_MANY_ATTEMPTS', 'PASSWORD_SET', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "SignInMethod" AS ENUM ('PASSWORD', 'CONSOLE_SESSION', 'EMAIL_LINK');

-- CreateTable
CREATE TABLE "SignInEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "appUserId" TEXT,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "outcome" "SignInOutcome" NOT NULL,
    "method" "SignInMethod" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignInEvent_applicationId_createdAt_idx" ON "SignInEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "SignInEvent_organizationId_idx" ON "SignInEvent"("organizationId");

-- CreateIndex
CREATE INDEX "SignInEvent_createdAt_idx" ON "SignInEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "SignInEvent" ADD CONSTRAINT "SignInEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInEvent" ADD CONSTRAINT "SignInEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInEvent" ADD CONSTRAINT "SignInEvent_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignInEvent" ADD CONSTRAINT "SignInEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

