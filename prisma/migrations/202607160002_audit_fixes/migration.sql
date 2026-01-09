ALTER TABLE "ModerationAction" ADD COLUMN "topicId" TEXT;

CREATE INDEX "ModerationAction_topicId_idx" ON "ModerationAction"("topicId");
CREATE INDEX "UserPreference_profilePublic_idx" ON "UserPreference"("profilePublic");

ALTER TABLE "ModerationAction"
ADD CONSTRAINT "ModerationAction_topicId_fkey"
FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
