CREATE TYPE "DuelSourceKind" AS ENUM ('daily', 'generated');
CREATE TYPE "DuelStatus" AS ENUM ('waiting', 'question', 'reveal', 'completed', 'forfeited');

ALTER TABLE "Match"
  ADD COLUMN "sourceKind" "DuelSourceKind" NOT NULL DEFAULT 'daily',
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "inviteTokenHash" TEXT,
  ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "status" "DuelStatus" NOT NULL DEFAULT 'waiting',
  ADD COLUMN "roundIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "roundStartedAt" TIMESTAMP(3),
  ADD COLUMN "roundDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "revealEndsAt" TIMESTAMP(3),
  ADD COLUMN "winnerId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

UPDATE "Match" SET "sourceId" = "puzzleId" WHERE "sourceId" IS NULL;
ALTER TABLE "Match" ALTER COLUMN "sourceId" SET NOT NULL;

CREATE UNIQUE INDEX "Match_inviteTokenHash_key" ON "Match"("inviteTokenHash");
CREATE INDEX "Match_status_roundDeadlineAt_idx" ON "Match"("status", "roundDeadlineAt");
CREATE INDEX "Match_status_revealEndsAt_idx" ON "Match"("status", "revealEndsAt");

CREATE TABLE "DuelSubmission" (
  "id" TEXT NOT NULL,
  "duelId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "roundIndex" INTEGER NOT NULL,
  "value" DECIMAL(20,2) NOT NULL,
  "score" DECIMAL(30,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DuelSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DuelSubmission_duelId_playerId_roundIndex_key" ON "DuelSubmission"("duelId", "playerId", "roundIndex");
CREATE INDEX "DuelSubmission_duelId_roundIndex_idx" ON "DuelSubmission"("duelId", "roundIndex");
ALTER TABLE "DuelSubmission" ADD CONSTRAINT "DuelSubmission_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuelSubmission" ADD CONSTRAINT "DuelSubmission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
