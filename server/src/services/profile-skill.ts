import type { PrismaClient } from '@prisma/client';
import type { ProfileSkill } from 'shared';

const RECENT_DAYS = 7;

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

// Only daily-puzzle guesses count, so a profile compares like with like; private
// generated sets and practice runs stay out of it.
export async function getProfileSkill(prisma: PrismaClient, userId: string): Promise<ProfileSkill> {
  const guesses = await prisma.guess.findMany({ where: { userId }, select: { questionId: true, score: true } });
  if (guesses.length === 0) return { questionsPlayed: 0, averageMiss: null, bestMiss: null, recentDays: [] };

  const puzzles = await prisma.dailyPuzzle.findMany({
    where: { questionIds: { hasSome: guesses.map((guess) => guess.questionId) } },
    select: { puzzleDate: true, questionIds: true },
  });
  const dayByQuestion = new Map<string, Date>();
  for (const puzzle of puzzles) {
    for (const questionId of puzzle.questionIds) dayByQuestion.set(questionId, puzzle.puzzleDate);
  }

  const scoresByDay = new Map<number, number[]>();
  for (const guess of guesses) {
    const day = dayByQuestion.get(guess.questionId);
    const score = Number(guess.score);
    if (!day || !Number.isFinite(score)) continue;
    const scores = scoresByDay.get(day.getTime()) ?? [];
    scores.push(score);
    scoresByDay.set(day.getTime(), scores);
  }

  const dailyScores = [...scoresByDay.values()].flat();
  if (dailyScores.length === 0) return { questionsPlayed: 0, averageMiss: null, bestMiss: null, recentDays: [] };

  const recentDays = [...scoresByDay.entries()]
    .sort(([a], [b]) => b - a)
    .slice(0, RECENT_DAYS)
    .reverse()
    .map(([time, scores]) => ({ date: new Date(time).toISOString(), averageMiss: round2(mean(scores)) }));

  return {
    questionsPlayed: dailyScores.length,
    averageMiss: round2(mean(dailyScores)),
    bestMiss: round2(Math.min(...dailyScores)),
    recentDays,
  };
}
