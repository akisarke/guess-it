import type { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notifications.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    const rawLimit = Number((request.query as { limit?: string }).limit ?? 20);
    return listNotifications(app.prisma, request.userId!, Number.isFinite(rawLimit) ? rawLimit : 20);
  });

  app.post('/read-all', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    await markAllNotificationsRead(app.prisma, request.userId!);
    return { success: true };
  });

  app.post('/:id/read', { preHandler: [authenticate, requireRegistered] }, async (request) => {
    await markNotificationRead(app.prisma, request.userId!, (request.params as { id: string }).id);
    return { success: true };
  });
}
