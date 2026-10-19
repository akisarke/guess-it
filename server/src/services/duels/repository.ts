import type { PrismaClient } from '@prisma/client';
import { parseDuelId, parsePlayerId, type PlayerId } from 'shared';
import { DUEL_TIMEOUT_SCORE, restoreDuelState, type DuelDomainQuestion, type DuelDomainState, type DuelSubmissionPair } from './domain.js';
import { selectDuelCatalogQuestions } from '../question-catalog.js';

function tuple3<T>(values: readonly T[]): readonly [T, T, T] {
  const [first, second, third] = values;
  if (first === undefined || second === undefined || third === undefined) throw new Error('Expected three Duel values.');
  return [first, second, third];
}

export class DuelRepositoryError extends Error {
  constructor(readonly code: 'DUEL_NOT_FOUND' | 'STALE_VERSION', message: string) {
    super(message);
    this.name = 'DuelRepositoryError';
  }
}

function statusFor(state: DuelDomainState): 'question' | 'reveal' | 'completed' | 'forfeited' {
  switch (state.phase) {
    case 'question': return 'question';
    case 'reveal': return 'reveal';
    case 'completed': return 'completed';
    case 'forfeited': return 'forfeited';
    case 'waiting': return 'question';
    default: return state.phase satisfies never;
  }
}

function dateOrNull(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export async function loadDuel(prisma: PrismaClient, duelId: string) {
  return prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      submissions: { orderBy: [{ roundIndex: 'asc' }, { playerId: 'asc' }] },
      playerAUser: { select: { id: true, displayName: true, avatarUrl: true, bio: true } },
      playerBUser: { select: { id: true, displayName: true, avatarUrl: true, bio: true } },
    },
  });
}

export async function loadDuelState(prisma: PrismaClient, duelId: string, now: Date): Promise<DuelDomainState | null> {
  const duel = await loadDuel(prisma, duelId);
  if (!duel) return null;

  const dailyQuestionIds = duel.sourceKind === 'daily'
    ? (await prisma.dailyPuzzle.findUnique({ where: { id: duel.sourceId }, select: { questionIds: true } }))?.questionIds ?? []
    : [];
  const questionIds = duel.sourceKind === 'daily'
    ? await selectDuelCatalogQuestions(prisma, now, duel.id, dailyQuestionIds)
    : (await prisma.questionSet.findUnique({ where: { id: duel.sourceId }, select: { questions: { orderBy: { position: 'asc' }, select: { questionId: true } } } }))?.questions.map(({ questionId }) => questionId) ?? [];
  const rows = await prisma.question.findMany({
    where: { id: { in: questionIds.slice(0, 3) } },
    select: { id: true, prompt: true, unit: true, answer: true },
  });
  const byId = new Map(rows.map((question) => [question.id, question]));
  const questions = questionIds.slice(0, 3).map((id) => byId.get(id)).filter((question): question is (typeof rows)[number] => question !== undefined);
  if (questions.length !== 3) return null;
  const domainQuestions = tuple3(questions.map((question) => ({ id: question.id, prompt: question.prompt, unit: question.unit, answer: Number(question.answer) })));
  const players: readonly [{ playerId: PlayerId; displayName: string; avatarUrl: string | null; bio: string | null }, { playerId: PlayerId; displayName: string; avatarUrl: string | null; bio: string | null }] = [
    { playerId: parsePlayerId(duel.playerAUser.id), displayName: duel.playerAUser.displayName, avatarUrl: duel.playerAUser.avatarUrl, bio: duel.playerAUser.bio },
    { playerId: parsePlayerId(duel.playerBUser.id), displayName: duel.playerBUser.displayName, avatarUrl: duel.playerBUser.avatarUrl, bio: duel.playerBUser.bio },
  ];
  const submissions = tuple3([0, 1, 2].map((roundIndex): DuelSubmissionPair => {
    const first = duel.submissions.find((item) => item.roundIndex === roundIndex && item.playerId === duel.playerA);
    const second = duel.submissions.find((item) => item.roundIndex === roundIndex && item.playerId === duel.playerB);
    return [
     first ? { value: first.value === null ? DUEL_TIMEOUT_SCORE : Number(first.value), score: Number(first.score), timedOut: first.value === null } : null,
     second ? { value: second.value === null ? DUEL_TIMEOUT_SCORE : Number(second.value), score: Number(second.score), timedOut: second.value === null } : null,
    ];
  }));
  const phase = duel.status === 'waiting' ? 'waiting' : duel.status;
  const winner = duel.winnerId === null ? null : duel.winnerId === duel.playerA || duel.winnerId === duel.playerB ? parsePlayerId(duel.winnerId) : 'draw';
  return restoreDuelState({ duelId: parseDuelId(duel.id), players, questions: domainQuestions, submissions, phase, roundIndex: duel.roundIndex, roundStartedAt: duel.roundStartedAt?.toISOString() ?? null, roundDeadline: duel.roundDeadlineAt?.toISOString() ?? null, revealEndsAt: duel.revealEndsAt?.toISOString() ?? null, disconnectedUntil: [null, null], winner, version: duel.version, now });
}

export async function saveDuelState(prisma: PrismaClient, state: DuelDomainState, expectedVersion: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.duel.updateMany({
      where: { id: state.duelId, version: expectedVersion },
      data: {
        status: statusFor(state),
        roundIndex: state.roundIndex,
        roundStartedAt: dateOrNull(state.roundStartedAt),
        roundDeadlineAt: dateOrNull(state.roundDeadline),
        revealEndsAt: dateOrNull(state.revealEndsAt),
        winnerId: state.winner === null || state.winner === 'draw' ? null : state.winner,
        completedAt: state.phase === 'completed' || state.phase === 'forfeited' ? new Date() : null,
        version: state.version,
      },
    });
    if (updated.count !== 1) {
      const existing = await tx.duel.findUnique({ where: { id: state.duelId }, select: { id: true } });
      if (!existing) throw new DuelRepositoryError('DUEL_NOT_FOUND', 'Duel not found.');
      throw new DuelRepositoryError('STALE_VERSION', 'Duel changed before this transition was saved.');
    }
    for (const [roundIndex, round] of state.rounds.entries()) {
      for (const [playerIndex, submission] of round.submissions.entries()) {
        if (!submission) continue;
        const playerId = state.players[playerIndex].playerId;
        await tx.duelSubmission.upsert({
          where: { duelId_playerId_roundIndex: { duelId: state.duelId, playerId, roundIndex } },
           update: { value: submission.timedOut ? null : submission.value, score: submission.score },
           create: { duelId: state.duelId, playerId, roundIndex, value: submission.timedOut ? null : submission.value, score: submission.score },
        });
      }
    }
  });
}
