-- Hot-path indexes derived from live query call sites.
-- Guess: distribution (per-question scan), weekly leaderboard (createdAt range),
--        and the Question FK (currently unindexed).
CREATE INDEX "Guess_questionId_idx" ON "Guess"("questionId");
CREATE INDEX "Guess_createdAt_idx" ON "Guess"("createdAt");

-- MatchmakingQueueEntry: findFirst by user ordered by queuedAt (every queue op),
--        lockQueue expiry sweep (status + queuedAt), raw SQL NOT EXISTS (userId + queuedAt).
CREATE INDEX "MatchmakingQueueEntry_userId_queuedAt_idx" ON "MatchmakingQueueEntry"("userId", "queuedAt");
CREATE INDEX "MatchmakingQueueEntry_status_queuedAt_idx" ON "MatchmakingQueueEntry"("status", "queuedAt");

-- Match (Duel): OR [playerA, playerB] lookups on every joinQueue/getQueueStatus
--        (Prisma maps model Duel to table "Match").
CREATE INDEX "Match_playerA_idx" ON "Match"("playerA");
CREATE INDEX "Match_playerB_idx" ON "Match"("playerB");
