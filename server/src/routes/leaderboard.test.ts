import { describe, expect, it, vi } from 'vitest';
import { buildLeaderboard } from './leaderboard.js';

describe('buildLeaderboard', () => {
  it('returns public avatar and pinned non-secret badge metadata', async () => {
    const userBadgeFindMany = vi.fn().mockResolvedValue([
      { userId: 'u1', badgeId: 'first', badge: { name: 'First Guess' } },
    ]);
    const prisma = {
      guess: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'u1', score: '1.2345', user: { displayName: 'Ada', hackclubId: 'hc-1', avatarUrl: '/avatars/ada.png' } },
          { userId: 'u2', score: '2', user: { displayName: 'Lin', hackclubId: null, avatarUrl: null } },
        ]),
      },
      userBadge: { findMany: userBadgeFindMany },
    };

    const result = await buildLeaderboard(prisma as never, {});

    expect(result).toEqual([
      {
        userId: 'u1',
        displayName: 'Ada',
        avatarUrl: '/avatars/ada.png',
        score: 1.2345,
        rank: 1,
        isHackClubMember: true,
        pinnedBadges: [{ badgeId: 'first', badge: { name: 'First Guess' } }],
      },
      {
        userId: 'u2',
        displayName: 'Lin',
        avatarUrl: null,
        score: 2,
        rank: 2,
        isHackClubMember: false,
        pinnedBadges: [],
      },
    ]);
    expect(userBadgeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: { in: ['u1', 'u2'] }, isPinned: true, badge: { isSecret: false } },
    }));
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('email');
  });

  it('excludes anonymous players from the query so they never get a rank', async () => {
    const guessFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      guess: { findMany: guessFindMany },
      userBadge: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await buildLeaderboard(prisma as never, { questionId: { in: ['q1'] } });

    expect(guessFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        questionId: { in: ['q1'] },
        user: { authProvider: { not: 'anonymous' } },
      },
    }));
  });
});
