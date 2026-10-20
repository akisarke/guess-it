import type { DailyPuzzle, Duel, MatchmakingQueueEntry, Prisma, PrismaClient } from '@prisma/client';
import { getTodayPuzzle } from './daily-puzzle.js';
import { selectDuelCatalogQuestions } from './question-catalog.js';
import { ExternalServiceError } from '../errors/application-error.js';

const QUEUE_LIFETIME_MS = 5 * 60 * 1000;
class PuzzleUnavailableError extends ExternalServiceError {
  constructor() { super('The daily puzzle is unavailable. Please try again later.'); }
}
type MatchDetails = Duel & {
  opponent: {
    id: string;
    displayName: string;
    completed: boolean;
    score: number | null;
  };
};
type QueueResult = {
  status: 'idle' | 'waiting' | 'matched';
  entryId: string | null;
  match: MatchDetails | null;
  isNewMatch: boolean;
};
const idle: QueueResult = { status: 'idle', entryId: null, match: null, isNewMatch: false };

async function lockQueue(tx: Prisma.TransactionClient) {

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71628394)`;
  await tx.matchmakingQueueEntry.updateMany({
    where: { status: 'waiting', queuedAt: { lt: new Date(Date.now() - QUEUE_LIFETIME_MS) } },
    data: { status: 'expired' },
  });
}

async function matchDetails(tx: Prisma.TransactionClient, match: Duel, userId: string): Promise<MatchDetails> {
  const opponentId = match.playerA === userId ? match.playerB : match.playerA;
  const opponent = await tx.user.findUniqueOrThrow({
    where: { id: opponentId }, select: { id: true, displayName: true },
  });

  const dailyQuestionIds = (await tx.dailyPuzzle.findUnique({ where: { id: match.sourceId }, select: { questionIds: true } }))?.questionIds ?? [];
  const questionIds = await selectDuelCatalogQuestions(tx, new Date(), match.id, dailyQuestionIds);
  const guesses = await tx.guess.findMany({
    where: { userId: opponentId, questionId: { in: [...questionIds] } }, select: { score: true },
  });
  const completed = guesses.length === questionIds.length;
  return { ...match, opponent: {
    ...opponent, completed,
    score: completed ? guesses.reduce((sum, guess) => sum + Number(guess.score), 0) / guesses.length : null,
  } };
}

async function findMatch(tx: Prisma.TransactionClient, userId: string, puzzle: DailyPuzzle): Promise<QueueResult> {
  const entry = await tx.matchmakingQueueEntry.findFirst({
    where: { userId }, orderBy: [{ queuedAt: 'desc' }, { id: 'desc' }],
  });
  if (!entry || entry.questionId !== null) return idle;
  switch (entry.status) {
    case 'expired':
      return idle;
    case 'matched': {
      const match = await tx.duel.findFirst({
        where: {
          OR: [{ playerA: userId }, { playerB: userId }],
          puzzleId: puzzle.id, createdAt: { gte: entry.queuedAt },
        }, orderBy: { createdAt: 'desc' },
      });
      return match
        ? { status: 'matched', entryId: entry.id, match: await matchDetails(tx, match, userId), isNewMatch: false }
        : idle;
    }
    case 'waiting': {
      const [waitingEntry] = await tx.$queryRaw<MatchmakingQueueEntry[]>`
        SELECT q.* FROM "MatchmakingQueueEntry" q
        WHERE q.status = 'waiting' AND q."questionId" IS NULL AND q."userId" <> ${userId}
          AND NOT EXISTS (
            SELECT 1 FROM "MatchmakingQueueEntry" newer
            WHERE newer."userId" = q."userId"
              AND (newer."queuedAt", newer.id) > (q."queuedAt", q.id)
          )
        ORDER BY q."queuedAt", q.id LIMIT 1`;
      if (!waitingEntry) return { status: 'waiting', entryId: entry.id, match: null, isNewMatch: false };
      const match = await tx.duel.create({ data: {
        puzzleId: puzzle.id, sourceKind: 'daily', sourceId: puzzle.id, playerA: waitingEntry.userId, playerB: userId,
        status: 'question', roundStartedAt: new Date(), roundDeadlineAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Math.max(Date.now(), entry.queuedAt.getTime(), waitingEntry.queuedAt.getTime())),
      } });
      await tx.matchmakingQueueEntry.updateMany({
        where: { id: { in: [entry.id, waitingEntry.id] } }, data: { status: 'matched' },
      });
      return { status: 'matched', entryId: entry.id, match: await matchDetails(tx, match, userId), isNewMatch: true };
    }
    default: {
      const unreachable: never = entry.status;
      return unreachable;
    }
  }
}

export async function joinQueue(prisma: PrismaClient, userId: string): Promise<QueueResult> {
  const puzzle = await getTodayPuzzle(prisma);
  if (!puzzle) throw new PuzzleUnavailableError();
  return prisma.$transaction(async tx => {
    await lockQueue(tx);
    const previousEntry = await tx.matchmakingQueueEntry.findFirst({
      where: { userId }, orderBy: { queuedAt: 'desc' },
    });

    if (previousEntry?.status === 'waiting' && previousEntry.questionId === null) {
      return findMatch(tx, userId, puzzle);
    }
    const previousMatch = await tx.duel.findFirst({
      where: { OR: [{ playerA: userId }, { playerB: userId }] }, orderBy: { createdAt: 'desc' },
    });
    await tx.matchmakingQueueEntry.updateMany({
      where: { userId, status: { in: ['waiting', 'matched'] } }, data: { status: 'expired' },
    });
    await tx.matchmakingQueueEntry.create({ data: {
      userId,
      queuedAt: new Date(Math.max(Date.now(), (previousEntry?.queuedAt.getTime() ?? 0) + 1,
        (previousMatch?.createdAt.getTime() ?? 0) + 1)),
    } });
    return findMatch(tx, userId, puzzle);
  });
}

export async function getQueueStatus(prisma: PrismaClient, userId: string): Promise<QueueResult> {
  const puzzle = await getTodayPuzzle(prisma);
  if (!puzzle) throw new PuzzleUnavailableError();
  return prisma.$transaction(async tx => {
    await lockQueue(tx);
    return findMatch(tx, userId, puzzle);
  });
}

export async function leaveQueue(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.$transaction(async tx => {
    await lockQueue(tx);
    await tx.matchmakingQueueEntry.updateMany({
      where: { userId, status: { in: ['waiting', 'matched'] } }, data: { status: 'expired' },
    });
  });
}


