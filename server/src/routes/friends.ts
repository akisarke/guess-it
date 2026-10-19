import type { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors/application-error.js';
import { createNotification } from '../services/notifications.js';

const publicUserSelect = { id: true, displayName: true, avatarUrl: true } as const;

type PublicUser = { id: string; displayName: string; avatarUrl: string | null };
type FriendRow = {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  sender: PublicUser;
  receiver: PublicUser;
};

function otherUser(row: FriendRow, userId: string): PublicUser {
  return row.senderId === userId ? row.receiver : row.sender;
}

export async function friendRoutes(app: FastifyInstance) {
  const prisma = app.prisma;

  app.get('/', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId!;
    const rows = await prisma.friendRequest.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: publicUserSelect }, receiver: { select: publicUserSelect } },
    });

    const friends: { requestId: string; user: PublicUser }[] = [];
    const incoming: { requestId: string; user: PublicUser }[] = [];
    const outgoing: { requestId: string; user: PublicUser }[] = [];

    for (const row of rows as FriendRow[]) {
      const item = { requestId: row.id, user: otherUser(row, userId) };
      if (row.status === 'accepted') friends.push(item);
      else if (row.receiverId === userId) incoming.push(item);
      else outgoing.push(item);
    }

    return { friends, incoming, outgoing };
  });

  app.post('/', { preHandler: [authenticate, requireRegistered] }, async (request, reply) => {
    const userId = request.userId!;
    const body = (request.body ?? {}) as { displayName?: unknown };
    const handle = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!handle) throw new ValidationError('Enter a display name.');
    if (handle.length > 100) throw new ValidationError('Display name is too long.');

    const target = await prisma.user.findUnique({ where: { displayName: handle }, select: { id: true } });
    if (!target) throw new NotFoundError('No player with that name.');
    if (target.id === userId) throw new ValidationError('You cannot friend yourself.');

    const existing = await prisma.friendRequest.findFirst({
      where: { OR: [{ senderId: userId, receiverId: target.id }, { senderId: target.id, receiverId: userId }] },
    });
    if (existing) {
      throw new ConflictError(
        existing.status === 'accepted' ? 'You are already friends.' : 'A friend request already exists between you.',
      );
    }

    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    await prisma.friendRequest.create({ data: { senderId: userId, receiverId: target.id } });
    try {
      await createNotification(prisma, {
        userId: target.id,
        type: 'friend_request',
        title: 'Friend request',
        message: `${sender?.displayName ?? 'A player'} sent you a friend request.`,
        actionUrl: '/profile',
        actionLabel: 'View request',
      });
    } catch (error) {
      request.log.error({ error, targetId: target.id }, 'Failed to create friend request notification');
    }
    reply.code(201);
    return { success: true };
  });

  app.post('/:id/accept', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId!;
    const { id } = request.params as { id: string };

    const row = await prisma.friendRequest.findUnique({ where: { id } });
    if (!row || row.status !== 'pending') throw new NotFoundError('Friend request not found.');
    if (row.receiverId !== userId) throw new NotFoundError('Friend request not found.');

    await prisma.friendRequest.update({ where: { id }, data: { status: 'accepted' } });
    return { success: true };
  });

  app.delete('/:id', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const userId = request.userId!;
    const { id } = request.params as { id: string };

    const row = await prisma.friendRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Friend request not found.');
    const isParty = row.senderId === userId || row.receiverId === userId;
    if (!isParty) throw new NotFoundError('Friend request not found.');

    await prisma.friendRequest.delete({ where: { id } });
    return { success: true };
  });
}
