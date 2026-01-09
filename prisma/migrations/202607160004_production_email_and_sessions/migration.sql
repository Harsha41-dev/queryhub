-- Add a monotonically increasing session version so password, email, suspension,
-- and deletion events can invalidate already-issued JWT sessions.
ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Email changes remain pending until a hashed, expiring, single-use token is
-- redeemed. The raw token is sent by the email provider and is never stored.
CREATE TABLE "EmailChangeToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "newEmail" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailChangeToken_tokenHash_key"
ON "EmailChangeToken"("tokenHash");

CREATE INDEX "EmailChangeToken_userId_expiresAt_idx"
ON "EmailChangeToken"("userId", "expiresAt");

CREATE INDEX "EmailChangeToken_newEmail_idx"
ON "EmailChangeToken"("newEmail");

ALTER TABLE "EmailChangeToken"
ADD CONSTRAINT "EmailChangeToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
