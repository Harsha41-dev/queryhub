-- Extend notifications for the new product workflows.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANSWER_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCEPTED_ANSWER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SPACE_POST';

CREATE TYPE "AnswerRequestStatus" AS ENUM ('PENDING', 'ANSWERED', 'DISMISSED');
CREATE TYPE "FeedFeedbackType" AS ENUM ('HIDE_QUESTION', 'MUTE_USER', 'NOT_INTERESTED_TOPIC');
CREATE TYPE "NotificationMuteTargetType" AS ENUM ('USER', 'TOPIC');
CREATE TYPE "SpaceRole" AS ENUM ('OWNER', 'MODERATOR', 'CONTRIBUTOR', 'MEMBER');
CREATE TYPE "SpaceQuestionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "BadgeType" AS ENUM ('TOP_WRITER', 'HELPFUL_ANSWER', 'TOPIC_EXPERT', 'MODERATOR', 'VERIFIED_CONTRIBUTOR');

ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
ALTER TABLE "Question" ADD COLUMN "acceptedAnswerId" TEXT;
ALTER TABLE "Answer" ADD COLUMN "credentialId" TEXT;
ALTER TABLE "Bookmark" ADD COLUMN "collectionId" TEXT;
ALTER TABLE "UserPreference" ADD COLUMN "emailAnswerRequests" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserPreference" ADD COLUMN "emailAcceptedAnswers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserPreference" ADD COLUMN "emailSpacePosts" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UserCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT,
    "label" VARCHAR(160) NOT NULL,
    "organization" VARCHAR(120),
    "url" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerRequest" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requestedUserId" TEXT NOT NULL,
    "message" VARCHAR(500),
    "status" "AnswerRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "AnswerRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "authorId" TEXT,
    "topicId" TEXT,
    "type" "FeedFeedbackType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "color" TEXT,
    "image" TEXT,
    "ownerId" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpaceMember" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId","userId")
);

CREATE TABLE "SpaceQuestion" (
    "spaceId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "status" "SpaceQuestionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceQuestion_pkey" PRIMARY KEY ("spaceId","questionId")
);

CREATE TABLE "BookmarkCollection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookmarkCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationMute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "NotificationMuteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationMute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Question_acceptedAnswerId_key" ON "Question"("acceptedAnswerId");
CREATE INDEX "Answer_credentialId_idx" ON "Answer"("credentialId");
CREATE INDEX "Bookmark_collectionId_idx" ON "Bookmark"("collectionId");
CREATE INDEX "UserCredential_userId_isDefault_idx" ON "UserCredential"("userId", "isDefault");
CREATE INDEX "UserCredential_topicId_idx" ON "UserCredential"("topicId");
CREATE UNIQUE INDEX "AnswerRequest_questionId_requestedUserId_key" ON "AnswerRequest"("questionId", "requestedUserId");
CREATE INDEX "AnswerRequest_requesterId_createdAt_idx" ON "AnswerRequest"("requesterId", "createdAt");
CREATE INDEX "AnswerRequest_requestedUserId_status_createdAt_idx" ON "AnswerRequest"("requestedUserId", "status", "createdAt");
CREATE UNIQUE INDEX "FeedFeedback_userId_questionId_type_key" ON "FeedFeedback"("userId", "questionId", "type");
CREATE UNIQUE INDEX "FeedFeedback_userId_authorId_type_key" ON "FeedFeedback"("userId", "authorId", "type");
CREATE UNIQUE INDEX "FeedFeedback_userId_topicId_type_key" ON "FeedFeedback"("userId", "topicId", "type");
CREATE INDEX "FeedFeedback_userId_type_idx" ON "FeedFeedback"("userId", "type");
CREATE UNIQUE INDEX "Space_name_key" ON "Space"("name");
CREATE UNIQUE INDEX "Space_slug_key" ON "Space"("slug");
CREATE INDEX "Space_followerCount_idx" ON "Space"("followerCount");
CREATE INDEX "Space_deletedAt_followerCount_idx" ON "Space"("deletedAt", "followerCount");
CREATE INDEX "SpaceMember_userId_role_idx" ON "SpaceMember"("userId", "role");
CREATE INDEX "SpaceQuestion_questionId_idx" ON "SpaceQuestion"("questionId");
CREATE INDEX "SpaceQuestion_spaceId_status_createdAt_idx" ON "SpaceQuestion"("spaceId", "status", "createdAt");
CREATE UNIQUE INDEX "BookmarkCollection_userId_name_key" ON "BookmarkCollection"("userId", "name");
CREATE INDEX "BookmarkCollection_userId_createdAt_idx" ON "BookmarkCollection"("userId", "createdAt");
CREATE UNIQUE INDEX "UserBadge_userId_type_label_key" ON "UserBadge"("userId", "type", "label");
CREATE INDEX "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");
CREATE UNIQUE INDEX "NotificationMute_userId_targetType_targetId_key" ON "NotificationMute"("userId", "targetType", "targetId");
CREATE INDEX "NotificationMute_userId_targetType_idx" ON "NotificationMute"("userId", "targetType");
CREATE INDEX "NotificationMute_targetType_targetId_idx" ON "NotificationMute"("targetType", "targetId");

ALTER TABLE "Question" ADD CONSTRAINT "Question_acceptedAnswerId_fkey" FOREIGN KEY ("acceptedAnswerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "UserCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BookmarkCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnswerRequest" ADD CONSTRAINT "AnswerRequest_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerRequest" ADD CONSTRAINT "AnswerRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerRequest" ADD CONSTRAINT "AnswerRequest_requestedUserId_fkey" FOREIGN KEY ("requestedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedFeedback" ADD CONSTRAINT "FeedFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedFeedback" ADD CONSTRAINT "FeedFeedback_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedFeedback" ADD CONSTRAINT "FeedFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedFeedback" ADD CONSTRAINT "FeedFeedback_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceQuestion" ADD CONSTRAINT "SpaceQuestion_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceQuestion" ADD CONSTRAINT "SpaceQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceQuestion" ADD CONSTRAINT "SpaceQuestion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceQuestion" ADD CONSTRAINT "SpaceQuestion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookmarkCollection" ADD CONSTRAINT "BookmarkCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationMute" ADD CONSTRAINT "NotificationMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
