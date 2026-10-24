import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { GeneratedQuestion, GeneratedQuestionSet, GeneratedQuestionSetSummary } from 'shared';
import { parseGeneratedQuestionSetId, parseQuestionId } from 'shared';
import { utcDayRange } from './daily-puzzle.js';
import { RateLimitError } from '../errors/application-error.js';

const MAX_GENERATIONS_PER_DAY = 3;
const MAX_TRANSACTION_RETRIES = 3;

export type GeneratedQuestionInput = {
  prompt: string;
  unit: string;
  answer: number;
  napkinMath: string;
};

export type CreateGeneratedSetInput = {
  ownerId: string;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  questions: readonly [GeneratedQuestionInput, GeneratedQuestionInput, GeneratedQuestionInput];
  sourceUrl: string;
  now?: Date;
};

export class GeneratedSetQuotaError extends RateLimitError {
  constructor(resetAt?: string, resetAtMs?: number) {
    super('Daily generation limit reached', {
      code: 'GENERATION_QUOTA_EXCEEDED',
      resetAt,
      resetAtMs,
    });
  }
}

function toGeneratedQuestion(question: { id: string; prompt: string; unit: string }): GeneratedQuestion {
  return { id: parseQuestionId(question.id), prompt: question.prompt, unit: question.unit };
}

function toSummary(
  set: { id: string; title: string; topic: string; difficulty: string | null; createdAt: Date },
  completed: boolean,
): GeneratedQuestionSetSummary {
  const difficulty = set.difficulty === 'easy' || set.difficulty === 'medium' || set.difficulty === 'hard' ? set.difficulty : null;
  return { id: set.id, title: set.title, topic: set.topic, difficulty, createdAt: set.createdAt.toISOString(), completed };
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function createGeneratedSet(
  prisma: PrismaClient,
  input: CreateGeneratedSetInput,
): Promise<{ set: GeneratedQuestionSet; remainingGenerations: number }> {
  const now = input.now ?? new Date();
  const day = utcDayRange(now);

  for (let retry = 0; retry < MAX_TRANSACTION_RETRIES; retry += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.ownerId} || ':' || ${day.gte.toISOString()}, 0::bigint))`;
        const previousCount = await tx.generationAttempt.count({ where: { userId: input.ownerId, utcDay: day } });
        if (previousCount >= MAX_GENERATIONS_PER_DAY) throw new GeneratedSetQuotaError();
        const remainingGenerations = 2 - previousCount;

        const createdQuestions = [];
        for (const question of input.questions) {
          createdQuestions.push(await tx.question.create({
            data: {
              prompt: question.prompt,
              unit: question.unit,
              answer: question.answer,
              napkinMath: question.napkinMath,
              sourceTitle: 'Guess It! generated question',
              sourceUrl: input.sourceUrl,
              source: 'ai_generated',
              createdBy: input.ownerId,
              topic: input.topic,
            },
            select: { id: true, prompt: true, unit: true },
          }));
        }
        const set = await tx.questionSet.create({
          data: {
            ownerId: input.ownerId,
            title: input.title,
            topic: input.topic,
            difficulty: input.difficulty,
            source: 'ai_generated',
            questions: { create: createdQuestions.map((question, position) => ({ questionId: question.id, position })) },
          },
          include: { questions: { orderBy: { position: 'asc' }, include: { question: { select: { id: true, prompt: true, unit: true } } } } },
        });
        await tx.generationAttempt.create({ data: { userId: input.ownerId, setId: set.id, utcDay: day.gte } });
        const questions = set.questions.map(({ question }) => toGeneratedQuestion(question));
        return {
          set: {
            ...toSummary(set, false),
            id: parseGeneratedQuestionSetId(set.id),
            questions: [questions[0], questions[1], questions[2]],
          },
          remainingGenerations,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (!isSerializationConflict(error) || retry === MAX_TRANSACTION_RETRIES - 1) throw error;
    }
  }
  throw new Error('Generated-set transaction retry limit reached');
}

export async function getRemainingGenerations(prisma: PrismaClient, userId: string, now: Date): Promise<number> {
  const day = utcDayRange(now);
  const count = await prisma.generationAttempt.count({ where: { userId, utcDay: day } });
  return Math.max(0, MAX_GENERATIONS_PER_DAY - count);
}

export async function listGeneratedSets(
  prisma: PrismaClient,
  viewerId: string,
  ownerId: string,
): Promise<readonly GeneratedQuestionSetSummary[]> {
  const sets = await prisma.questionSet.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      createdAt: true,
      questions: {
        select: { question: { select: { guesses: { where: { userId: viewerId }, select: { id: true }, take: 1 } } } },
      },
    },
  });
  return sets.map((set) => toSummary(set, set.questions.length === 3 && set.questions.every(({ question }) => question.guesses.length > 0)));
}

export async function deleteGeneratedSet(prisma: PrismaClient, userId: string, setId: string): Promise<void> {
  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    select: { ownerId: true },
  });
  if (!set || set.ownerId !== userId) {
    throw new Error('Not found');
  }
  await prisma.$transaction(async (tx) => {
    const questionIds = await tx.questionSetQuestion.findMany({
      where: { setId },
      select: { questionId: true },
    });
    await tx.questionSetQuestion.deleteMany({ where: { setId } });
    await tx.question.deleteMany({ where: { id: { in: questionIds.map((q) => q.questionId) } } });
    await tx.questionSet.delete({ where: { id: setId } });
    await tx.generationAttempt.deleteMany({ where: { setId } });
  });
}
