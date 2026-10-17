import { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../errors/application-error.js';

export async function badgeRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const allBadges = await prisma.badge.findMany();
    const userBadges = request.userId
      ? await prisma.userBadge.findMany({ where: { userId: request.userId } })
      : [];

    return allBadges
      .filter(b => !b.isSecret || userBadges.some(ub => ub.badgeId === b.id))
      .map(b => ({
        ...b,
        earned: userBadges.some(ub => ub.badgeId === b.id),
        earnedAt: userBadges.find(ub => ub.badgeId === b.id)?.grantedAt,
      }));
  });

app.post('/:badgeId/pin', { preHandler: [authenticate, requireRegistered] }, async (request, reply) => {
    const { badgeId } = request.params as { badgeId: string };
    const { pin } = request.body as { pin: boolean };

    const userBadge = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId: request.userId!, badgeId } },
    });

    if (!userBadge) {
      throw new NotFoundError('Badge not earned');
    }

    if (pin) {
      const pinnedCount = await prisma.userBadge.count({
        where: { userId: request.userId!, isPinned: true },
      });

      if (pinnedCount >= 3) {
        throw new ValidationError('Maximum 3 badges can be pinned');
      }
    }

    await prisma.userBadge.update({
      where: { userId_badgeId: { userId: request.userId!, badgeId } },
      data: {
        isPinned: pin,
        pinnedAt: pin ? new Date() : null,
      },
    });

    return { success: true };
  });
}
