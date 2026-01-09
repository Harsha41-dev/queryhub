-- Cover the bounded feed, profile, topic, and nested-content access paths.
CREATE INDEX "User_deletedAt_suspendedAt_reputation_idx"
  ON "User"("deletedAt", "suspendedAt", "reputation");

CREATE INDEX "Question_deletedAt_isHidden_createdAt_idx"
  ON "Question"("deletedAt", "isHidden", "createdAt");

CREATE INDEX "Answer_questionId_deletedAt_isHidden_score_idx"
  ON "Answer"("questionId", "deletedAt", "isHidden", "score");

CREATE INDEX "Comment_answerId_deletedAt_isHidden_createdAt_idx"
  ON "Comment"("answerId", "deletedAt", "isHidden", "createdAt");

CREATE INDEX "Topic_deletedAt_followerCount_idx"
  ON "Topic"("deletedAt", "followerCount");

-- Prisma's contains/insensitive search compiles to ILIKE. Trigram indexes keep
-- those bounded searches indexed without coupling the app to a search vendor.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);
CREATE INDEX "User_bio_trgm_idx" ON "User" USING GIN ("bio" gin_trgm_ops);
CREATE INDEX "Question_title_trgm_idx" ON "Question" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Question_description_trgm_idx" ON "Question" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Answer_content_trgm_idx" ON "Answer" USING GIN ("content" gin_trgm_ops);
CREATE INDEX "Topic_name_trgm_idx" ON "Topic" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Topic_description_trgm_idx" ON "Topic" USING GIN ("description" gin_trgm_ops);

ALTER TABLE "Question" ADD CONSTRAINT "Question_nonnegative_counters"
  CHECK ("answerCount" >= 0 AND "viewCount" >= 0);
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_nonnegative_comment_count"
  CHECK ("commentCount" >= 0);
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_nonnegative_counters"
  CHECK ("followerCount" >= 0 AND "questionCount" >= 0);
