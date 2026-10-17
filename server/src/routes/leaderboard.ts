import { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { utcDayRange } from '../services/daily-puzzle.js';

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  score: number;
  rank: number;
  isHackClubMember: boolean;
  pinnedBadges: readonly { badgeId: string; badge: { name: string } }[];
};

type LeaderboardPrisma = Pick<PrismaClient, 'guess' | 'userBadge'>;

export async function buildLeaderboard(prisma: LeaderboardPrisma, where: Prisma.GuessWhereInput): Promise<LeaderboardEntry[]> {
  const guesses = await prisma.guess.findMany({
    // Anonymous players get a throwaway display name, so they never belong on a public board.
    where: { ...where, user: { authProvider: { not: 'anonymous' } } },
    select: {
      userId: true,
      score: true,
      user: { select: { displayName: true, hackclubId: true, avatarUrl: true, bio: true } },
    },
  });

  type UserScore = {
    total: number;
    count: number;
    user: (typeof guesses)[number]['user'];
  };
  const userScores = new Map<string, UserScore>();

  for (const guess of guesses) {
    const existing = userScores.get(guess.userId);
    if (existing) {
      existing.total += Number(guess.score);
      existing.count++;
    } else {
      userScores.set(guess.userId, { total: Number(guess.score), count: 1, user: guess.user });
    }
  }

  const ranked = Array.from(userScores.entries())
    .map(([userId, data]) => ({
      userId,
      displayName: data.user.displayName,
      avatarUrl: data.user.avatarUrl,
      bio: data.user.bio,
      score: data.total / data.count,
      rank: 0,
      isHackClubMember: data.user.hackclubId !== null,
      pinnedBadges: [],
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (userScores.get(b.userId)?.count ?? 0) - (userScores.get(a.userId)?.count ?? 0);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const userIds = ranked.map((entry) => entry.userId);
  const pinnedBadges = userIds.length
    ? await prisma.userBadge.findMany({
        where: { userId: { in: userIds }, isPinned: true, badge: { isSecret: false } },
        select: { userId: true, badgeId: true, badge: { select: { name: true } } },
      })
    : [];
  const badgesByUser = new Map<string, { badgeId: string; badge: { name: string } }[]>();
  for (const pinnedBadge of pinnedBadges) {
    const list = badgesByUser.get(pinnedBadge.userId) ?? [];
    list.push({ badgeId: pinnedBadge.badgeId, badge: pinnedBadge.badge });
    badgesByUser.set(pinnedBadge.userId, list);
  }

  return ranked.map((entry) => ({
    ...entry,
    score: Number(entry.score.toFixed(4)),
    pinnedBadges: badgesByUser.get(entry.userId) ?? [],
  }));
}

export async function leaderboardRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

app.get('/', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const { scope = 'daily', friends = 'false' } = request.query as {
      scope?: string;
      friends?: string;
    };

    const friendsOnly = friends === 'true';

    const where: Prisma.GuessWhereInput = {};

    if (scope === 'daily' || scope === 'weekly') {
      const day = utcDayRange(new Date());
      if (scope === 'daily') {
        const puzzle = await prisma.dailyPuzzle.findFirst({ where: { puzzleDate: day } });
        where.questionId = { in: puzzle?.questionIds ?? [] };
      } else {
        const cutoff = new Date(day.gte);
        cutoff.setUTCDate(cutoff.getUTCDate() - 6);
        where.createdAt = { gte: cutoff, lt: day.lt };
      }
    }

    if (friendsOnly) {
      const rows = await prisma.friendRequest.findMany({
        where: { status: 'accepted', OR: [{ senderId: request.userId! }, { receiverId: request.userId! }] },
        select: { senderId: true, receiverId: true },
      });
      const friendIds = rows.map((row) => (row.senderId === request.userId! ? row.receiverId : row.senderId));
      where.userId = { in: [request.userId!, ...friendIds] };
    }

    return buildLeaderboard(prisma, where);
  });
}
