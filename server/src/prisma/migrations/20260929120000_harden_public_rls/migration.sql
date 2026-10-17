ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "_prisma_migrations",
  "Notification",
  "User",
  "PasswordResetToken",
  "DailyPuzzle",
  "Question",
  "QuestionSet",
  "QuestionSetQuestion",
  "GenerationAttempt",
  "Guess",
  "Streak",
  "Badge",
  "UserBadge",
  "MatchmakingQueueEntry",
  "Match",
  "DuelSubmission"
FROM anon, authenticated;

CREATE POLICY "deny_public_access" ON "_prisma_migrations"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "Notification"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "User"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "PasswordResetToken"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "DailyPuzzle"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "Question"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "QuestionSet"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "QuestionSetQuestion"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "GenerationAttempt"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "Guess"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "Streak"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "Badge"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "UserBadge"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "MatchmakingQueueEntry"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "Match"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny_public_access" ON "DuelSubmission"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
