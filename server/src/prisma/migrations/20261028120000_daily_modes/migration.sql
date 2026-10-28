CREATE TYPE "GuessMode" AS ENUM ('easy', 'hard');

ALTER TABLE "Guess" ADD COLUMN "mode" "GuessMode" NOT NULL DEFAULT 'easy';

CREATE TABLE "PracticeGuess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" DECIMAL(20,2) NOT NULL,
    "score" DECIMAL(30,4) NOT NULL,
    "mode" "GuessMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeGuess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeGuess_userId_questionId_key" ON "PracticeGuess"("userId", "questionId");
CREATE INDEX "PracticeGuess_questionId_idx" ON "PracticeGuess"("questionId");

ALTER TABLE "PracticeGuess" ADD CONSTRAINT "PracticeGuess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeGuess" ADD CONSTRAINT "PracticeGuess_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
