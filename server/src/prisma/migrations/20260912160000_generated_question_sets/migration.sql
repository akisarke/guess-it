CREATE TABLE "QuestionSet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT,
    "source" "QuestionSource" NOT NULL DEFAULT 'ai_generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionSetQuestion" (
    "setId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuestionSetQuestion_pkey" PRIMARY KEY ("setId","position")
);

CREATE TABLE "GenerationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "utcDay" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Question_createdBy_idx" ON "Question"("createdBy");

CREATE INDEX "QuestionSet_ownerId_createdAt_idx" ON "QuestionSet"("ownerId", "createdAt");

CREATE INDEX "QuestionSetQuestion_questionId_idx" ON "QuestionSetQuestion"("questionId");

CREATE UNIQUE INDEX "QuestionSetQuestion_setId_questionId_key" ON "QuestionSetQuestion"("setId", "questionId");

CREATE UNIQUE INDEX "GenerationAttempt_setId_key" ON "GenerationAttempt"("setId");

CREATE INDEX "GenerationAttempt_userId_utcDay_idx" ON "GenerationAttempt"("userId", "utcDay");

ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionSetQuestion" ADD CONSTRAINT "QuestionSetQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionSetQuestion" ADD CONSTRAINT "QuestionSetQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GenerationAttempt" ADD CONSTRAINT "GenerationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GenerationAttempt" ADD CONSTRAINT "GenerationAttempt_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
