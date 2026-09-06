CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('EMAIL', 'DIGEST', 'PUSH');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "SpaceInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

ALTER TABLE "Question"
  ADD COLUMN "mergedIntoId" TEXT;

ALTER TABLE "Space"
  ADD COLUMN "rules" VARCHAR(2000),
  ADD COLUMN "allowMemberSubmissions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "UserBadge"
  ADD COLUMN "topicId" TEXT;

CREATE TABLE "UserTopicAffinity" (
  "userId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 0,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "answerCount" INTEGER NOT NULL DEFAULT 0,
  "voteCount" INTEGER NOT NULL DEFAULT 0,
  "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
  "followCount" INTEGER NOT NULL DEFAULT 0,
  "lastInteractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserTopicAffinity_pkey" PRIMARY KEY ("userId", "topicId")
);

CREATE TABLE "QuestionView" (
  "userId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionView_pkey" PRIMARY KEY ("userId", "questionId")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error" VARCHAR(500),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpaceInvite" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
  "status" "SpaceInviteStatus" NOT NULL DEFAULT 'PENDING',
  "message" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "SpaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Question_mergedIntoId_idx" ON "Question"("mergedIntoId");
CREATE INDEX "UserBadge_topicId_type_idx" ON "UserBadge"("topicId", "type");
CREATE INDEX "UserTopicAffinity_userId_weight_idx" ON "UserTopicAffinity"("userId", "weight");
CREATE INDEX "UserTopicAffinity_topicId_weight_idx" ON "UserTopicAffinity"("topicId", "weight");
CREATE INDEX "UserTopicAffinity_lastInteractedAt_idx" ON "UserTopicAffinity"("lastInteractedAt");
CREATE INDEX "QuestionView_userId_lastViewedAt_idx" ON "QuestionView"("userId", "lastViewedAt");
CREATE INDEX "QuestionView_questionId_lastViewedAt_idx" ON "QuestionView"("questionId", "lastViewedAt");
CREATE INDEX "NotificationDelivery_channel_status_createdAt_idx" ON "NotificationDelivery"("channel", "status", "createdAt");
CREATE INDEX "NotificationDelivery_notificationId_channel_idx" ON "NotificationDelivery"("notificationId", "channel");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_updatedAt_idx" ON "PushSubscription"("userId", "updatedAt");
CREATE UNIQUE INDEX "SpaceInvite_spaceId_inviteeId_key" ON "SpaceInvite"("spaceId", "inviteeId");
CREATE INDEX "SpaceInvite_inviteeId_status_createdAt_idx" ON "SpaceInvite"("inviteeId", "status", "createdAt");
CREATE INDEX "SpaceInvite_spaceId_status_createdAt_idx" ON "SpaceInvite"("spaceId", "status", "createdAt");

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserBadge"
  ADD CONSTRAINT "UserBadge_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserTopicAffinity"
  ADD CONSTRAINT "UserTopicAffinity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTopicAffinity"
  ADD CONSTRAINT "UserTopicAffinity_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionView"
  ADD CONSTRAINT "QuestionView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionView"
  ADD CONSTRAINT "QuestionView_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpaceInvite"
  ADD CONSTRAINT "SpaceInvite_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpaceInvite"
  ADD CONSTRAINT "SpaceInvite_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpaceInvite"
  ADD CONSTRAINT "SpaceInvite_inviteeId_fkey"
  FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
