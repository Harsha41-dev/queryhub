-- Indexes added after reviewing feed/search/report query patterns.
CREATE INDEX "Question_deletedAt_isHidden_viewCount_score_idx" ON "Question"("deletedAt", "isHidden", "viewCount", "score");
CREATE INDEX "Topic_deletedAt_questionCount_followerCount_idx" ON "Topic"("deletedAt", "questionCount", "followerCount");
CREATE INDEX "Report_questionId_status_createdAt_idx" ON "Report"("questionId", "status", "createdAt");
CREATE INDEX "Report_answerId_status_createdAt_idx" ON "Report"("answerId", "status", "createdAt");
CREATE INDEX "Report_commentId_status_createdAt_idx" ON "Report"("commentId", "status", "createdAt");
CREATE INDEX "Report_profileId_status_createdAt_idx" ON "Report"("profileId", "status", "createdAt");

-- Enforce the application invariant maintained by the credentials settings UI.
WITH ranked_defaults AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" ASC
    ) AS row_number
  FROM "UserCredential"
  WHERE "isDefault" = true
)
UPDATE "UserCredential"
SET "isDefault" = false
WHERE "id" IN (
  SELECT "id"
  FROM ranked_defaults
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "UserCredential_one_default_per_user_idx" ON "UserCredential"("userId") WHERE "isDefault" = true;
