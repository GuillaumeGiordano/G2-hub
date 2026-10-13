-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "ssoRedirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ssoSecretHash" TEXT,
ADD COLUMN     "ssoSecretPrefix" TEXT;

-- CreateTable
CREATE TABLE "OidcAuthCode" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "nonce" TEXT,
    "scope" TEXT NOT NULL,
    "authTime" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcAccessToken" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcSigningKey" (
    "kid" TEXT NOT NULL,
    "publicJwk" JSONB NOT NULL,
    "privateKeyPem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcSigningKey_pkey" PRIMARY KEY ("kid")
);

-- CreateIndex
CREATE UNIQUE INDEX "OidcAuthCode_hash_key" ON "OidcAuthCode"("hash");

-- CreateIndex
CREATE INDEX "OidcAuthCode_expiresAt_idx" ON "OidcAuthCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OidcAccessToken_hash_key" ON "OidcAccessToken"("hash");

-- CreateIndex
CREATE INDEX "OidcAccessToken_appUserId_idx" ON "OidcAccessToken"("appUserId");

-- CreateIndex
CREATE INDEX "OidcAccessToken_expiresAt_idx" ON "OidcAccessToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "OidcAuthCode" ADD CONSTRAINT "OidcAuthCode_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OidcAuthCode" ADD CONSTRAINT "OidcAuthCode_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OidcAccessToken" ADD CONSTRAINT "OidcAccessToken_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OidcAccessToken" ADD CONSTRAINT "OidcAccessToken_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

