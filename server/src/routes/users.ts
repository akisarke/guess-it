import { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { utcDayRange } from '../services/daily-puzzle.js';
import { parseProfileUpdate } from '../services/profile-input.js';
import { listGeneratedSets } from '../services/generated-sets.js';
import { getProfileSkill } from '../services/profile-skill.js';
import { parseUsername } from '../services/username-input.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../errors/application-error.js';

const publicProfileUserSelect = {
  id: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  isDeveloper: true,
  createdAt: true,
} as const;

const privateProfileUserSelect = {
  id: true,
  displayName: true,
  email: true,
  authProvider: true,
  hackclubId: true,
  bio: true,
  avatarUrl: true,
  usernameChosen: true,
  isDeveloper: true,
  isOwner: true,
  createdAt: true,
} as const;

const profileBadgeSelect = {
  badgeId: true,
  isPinned: true,
  grantedAt: true,
  badge: {
    select: {
      id: true,
      name: true,
      description: true,
      isSecret: true,
      isManualGrant: true,
    },
  },
} as const;

function presentStreak(streak: { currentStreak: number; longestStreak: number; lastPlayedOn: Date | null } | null) {
  if (!streak?.lastPlayedOn) return streak;

  const today = utcDayRange(new Date()).gte;
  const lastPlayed = utcDayRange(streak.lastPlayedOn).gte;
  const ageDays = Math.floor((today.getTime() - lastPlayed.getTime()) / 86_400_000);
  return ageDays > 1 ? { ...streak, currentStreak: 0 } : streak;
}

async function publicProfile(
  prisma: FastifyInstance['prisma'],
  user: { id: string; displayName: string; bio: string | null; avatarUrl: string | null; isDeveloper: boolean; createdAt: Date },
) {
  const publicUser = {
    id: user.id,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    isDeveloper: user.isDeveloper,
    createdAt: user.createdAt,
  };
  const streak = await prisma.streak.findUnique({ where: { userId: user.id } });
  const badges = await prisma.userBadge.findMany({
    where: { userId: user.id, badge: { isSecret: false } },
    select: profileBadgeSelect,
  });
  const pinnedBadges = badges.filter(b => b.isPinned);
  const generatedSets = await listGeneratedSets(prisma, user.id, user.id);
  const skill = await getProfileSkill(prisma, user.id);

  return { user: publicUser, streak: presentStreak(streak), skill, badges, pinnedBadges, generatedSets };
}

export async function userRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

app.get('/me/profile', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId;
    if (!userId) return { user: null, streak: null, badges: [], pinnedBadges: [], generatedSets: [] };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: privateProfileUserSelect });
    const streak = await prisma.streak.findUnique({ where: { userId } });
    const badges = await prisma.userBadge.findMany({
      where: { userId },
      select: profileBadgeSelect,
    });
    const pinnedBadges = badges.filter(b => b.isPinned);
    const generatedSets = await listGeneratedSets(prisma, userId, userId);
    const skill = await getProfileSkill(prisma, userId);

    return { user, streak: presentStreak(streak), skill, badges, pinnedBadges, generatedSets };
  });

  app.get<{ Params: { handle: string } }>('/handle/:handle/profile', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const parsed = parseUsername(request.params.handle);
    if (!parsed.ok) throw new ValidationError(parsed.error);

    const user = await prisma.user.findUnique({ where: { displayName: parsed.value }, select: publicProfileUserSelect });
    if (!user) throw new NotFoundError('User not found');
    return publicProfile(prisma, user);
  });

  app.get<{ Params: { id: string } }>('/:id/profile', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const { id } = request.params;
    const user = await prisma.user.findUnique({ where: { id }, select: publicProfileUserSelect });
    if (!user) throw new NotFoundError('User not found');
    return publicProfile(prisma, user);
  });

app.patch('/me/profile', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const parsed = parseProfileUpdate(request.body);
    if (!parsed.ok) throw new ValidationError(parsed.error);

    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { hackclubId: true } });
    if (!currentUser) throw new NotFoundError('User not found');
    if (parsed.value.displayName !== undefined && currentUser.hackclubId === null) {
      throw new ValidationError('Link Hack Club before choosing a public username.');
    }
    const profileData = parsed.value.displayName === undefined
      ? parsed.value
      : { ...parsed.value, usernameChosen: true };

    const user = await prisma.user.update({
      where: { id: userId },
      data: profileData,
      select: privateProfileUserSelect,
    });

    return { user };
  });

}
