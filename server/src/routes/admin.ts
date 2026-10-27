import { FastifyInstance } from 'fastify';
import { requireOwner } from '../services/owner.js';
import { awardBadge } from '../services/badges.js';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '../errors/application-error.js';

export async function adminRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/users', { preHandler: [requireOwner] }, async (request) => {
    const { search } = request.query as { search?: string };

    const where = search
      ? { displayName: { contains: search, mode: 'insensitive' as const } }
      : {};

    const users = await prisma.user.findMany({
      where,
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        isDeveloper: true,
        isOwner: true,
        createdAt: true,
      },
    });

    return { users };
  });

  app.get('/badges', { preHandler: [requireOwner] }, async () => {
    const badges = await prisma.badge.findMany({ orderBy: { name: 'asc' } });
    return { badges };
  });

  app.post('/grant-badge', { preHandler: [requireOwner] }, async (request) => {
    const { userId, badgeId, note } = request.body as {
      userId: string;
      badgeId: string;
      note?: string;
    };

    if (typeof userId !== 'string' || typeof badgeId !== 'string' || badgeId.length === 0) throw new ValidationError('User and badge are required');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) throw new NotFoundError('Badge not found');

    const granterId = request.userId;
    if (!granterId) throw new AuthenticationError('Not authenticated');

    const awarded = await awardBadge(prisma, userId, badgeId, granterId, note);

    if (!awarded) {
      throw new ConflictError('User already has this badge');
    }

    return { success: true };
  });
}
