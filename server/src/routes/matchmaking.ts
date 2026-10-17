import type { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { getQueueStatus, joinQueue, leaveQueue } from '../services/matchmaking.js';
import { AuthenticationError, ValidationError } from '../errors/application-error.js';
import { randomBytes, createHash } from 'node:crypto';
import { createNotification } from '../services/notifications.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../errors/application-error.js';
import { loadDuelState } from '../services/duels/repository.js';

export async function matchmakingRoutes(app: FastifyInstance) {
  app.post('/duels/invite', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const { targetUserId } = request.body as { targetUserId?: string };
    if (!targetUserId || targetUserId === userId) throw new ValidationError('Choose another registered player.');
    const target = await app.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, authProvider: true, displayName: true } });
    if (!target || target.authProvider === 'anonymous') throw new NotFoundError('Player not found');
    const friendship = await app.prisma.friendRequest.findFirst({
      where: { status: 'accepted', OR: [{ senderId: userId, receiverId: target.id }, { senderId: target.id, receiverId: userId }] },
    });
    if (!friendship) throw new ValidationError('You can only challenge accepted friends.');
    const puzzle = await app.prisma.dailyPuzzle.findFirst({ orderBy: { puzzleDate: 'desc' } });
    if (!puzzle) throw new ConflictError('No daily puzzle is available');
    const token = randomBytes(24).toString('base64url');
    const duel = await app.prisma.duel.create({ data: {
      puzzleId: puzzle.id,
      sourceKind: 'daily',
      sourceId: puzzle.id,
      playerA: userId,
      playerB: target.id,
      inviteTokenHash: createHash('sha256').update(token).digest('hex'),
      inviteExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    } });
    try {
      await createNotification(app.prisma, {
        userId: target.id,
        type: 'duel_invite',
        title: 'Duel invitation',
        message: 'A player invited you to a daily duel.',
        actionUrl: `/duels/challenge/${encodeURIComponent(token)}`,
        actionLabel: 'View invitation',
      });
      await createNotification(app.prisma, {
        userId,
        type: 'duel_invite',
        title: 'Challenge sent',
        message: `Challenge sent to ${target.displayName} — waiting for them to accept.`,
        actionUrl: `/duels/challenge/${encodeURIComponent(token)}`,
        actionLabel: 'Open challenge',
      });
    } catch (error) {
      request.log.error({ error, duelId: duel.id }, 'Failed to create duel invitation notification');
    }
    return { duelId: duel.id, token };
  });

  app.get('/duels/challenge/:token', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const { token } = request.params as { token: string };
    const duel = await app.prisma.duel.findUnique({
      where: { inviteTokenHash: createHash('sha256').update(token).digest('hex') },
      select: { id: true, playerA: true, playerB: true, status: true, inviteExpiresAt: true },
    });
    if (!duel) throw new NotFoundError('Challenge not found.');
    const you = duel.playerA === userId ? 'A' : duel.playerB === userId ? 'B' : null;
    if (!you) throw new NotFoundError('Challenge not found.');
    const opponentId = you === 'A' ? duel.playerB : duel.playerA;
    const opponent = await app.prisma.user.findUnique({
      where: { id: opponentId },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const state = duel.status === 'waiting'
      ? (duel.inviteExpiresAt && duel.inviteExpiresAt.getTime() < Date.now() ? 'expired' : 'waiting')
      : 'started';
    return { state, duelId: duel.id, you, opponent };
  });

  app.post('/duels/challenge/:token/accept', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const { token } = request.params as { token: string };
    const duel = await app.prisma.duel.findUnique({
      where: { inviteTokenHash: createHash('sha256').update(token).digest('hex') },
      select: { id: true, playerA: true, playerB: true, status: true, inviteExpiresAt: true },
    });
    if (!duel) throw new NotFoundError('Challenge not found.');
    if (duel.playerB !== userId) throw new AuthorizationError('Only the invited player can accept this challenge.');
    if (duel.status !== 'waiting') return { duelId: duel.id };
    if (duel.inviteExpiresAt && duel.inviteExpiresAt.getTime() < Date.now()) throw new ConflictError('This challenge has expired.');
    const now = new Date();
    await app.prisma.duel.updateMany({
      where: { id: duel.id, status: 'waiting' },
      data: { status: 'question', roundStartedAt: now, roundDeadlineAt: new Date(now.getTime() + 60_000) },
    });
    // ponytail: refresh coordinator if it hydrated the waiting state early (playerA opened battle page); edge case
    try {
      const state = await loadDuelState(app.prisma, duel.id, now);
      if (state) app.duelCoordinator.register(state);
    } catch (error) {
      request.log.error({ error, duelId: duel.id }, 'Failed to refresh duel coordinator state after accept');
    }
    return { duelId: duel.id };
  });

  app.post('/queue/join', {
    preHandler: [authenticate, requireRegistered],
    schema: { body: { type: 'object', properties: { questionId: { type: 'string' } }, additionalProperties: false } },
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    if (request.body && typeof request.body === 'object' && 'questionId' in request.body) {
      throw new ValidationError('Quickplay supports the daily puzzle only.');
    }
    return joinQueue(app.prisma, userId);
  });

  app.get('/queue/status', { preHandler: [authenticate, requireRegistered] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    return getQueueStatus(app.prisma, userId);
  });

  app.post('/queue/leave', { preHandler: [authenticate, requireRegistered] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    await leaveQueue(app.prisma, userId);
    return { success: true };
  });
}
