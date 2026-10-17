import type { NotificationType, PrismaClient } from '@prisma/client';

export async function createNotification(prisma: PrismaClient, data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
}) {
  return prisma.notification.create({ data });
}

export async function listNotifications(prisma: PrismaClient, userId: string, limit = 20) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
  });
  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
  return { notifications, unreadCount };
}

export async function markNotificationRead(prisma: PrismaClient, userId: string, id: string) {
  return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(prisma: PrismaClient, userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
