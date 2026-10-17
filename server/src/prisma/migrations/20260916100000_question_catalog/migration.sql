ALTER TABLE "Question"
  ADD COLUMN "sourceTitle" TEXT NOT NULL DEFAULT 'Guess It! legacy question',
  ADD COLUMN "sourceUrl" TEXT NOT NULL DEFAULT 'https://guessit.game/';

ALTER TABLE "Question"
  ALTER COLUMN "sourceTitle" DROP DEFAULT,
  ALTER COLUMN "sourceUrl" DROP DEFAULT;
