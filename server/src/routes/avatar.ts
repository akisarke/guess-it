import type { FastifyInstance } from 'fastify';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { AvatarUploadError, removeLocalAvatar, storeAvatarFile } from '../services/avatar-files.js';
import { buildLimiterKey, semanticLimit } from '../services/rate-limit.js';
import { AuthenticationError, ConflictError, ValidationError } from '../errors/application-error.js';

export async function avatarRoutes(app: FastifyInstance) {
app.post('/me/avatar', { preHandler: [authenticate, requireRegistered, semanticLimit('avatarIp', (request) => buildLimiterKey('avatar-ip', request.ip)), semanticLimit('avatarUser', (request) => request.userId ? buildLimiterKey('avatar-user', request.userId) : undefined)] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');

    const part = await request.file({ throwFileSizeLimit: false, limits: { files: 1, parts: 1, fileSize: app.config.avatarSecurity.maxEncodedBytes } });
    if (!part || part.fieldname !== 'avatar') {
      throw new ValidationError('Choose an image.');
    }

    let storedAvatar;
    try {
      storedAvatar = await storeAvatarFile(part.file, app.config.avatarUploadDir, app.config.avatarSecurity);
    } catch (error) {
      if (error instanceof AvatarUploadError) {
        throw error;
      }
      throw error;
    }

    let previousAvatarUrl: string | null = null;
    let databaseUpdateCommitted = false;
    try {
      const currentUser = await app.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
      previousAvatarUrl = currentUser?.avatarUrl ?? null;
      await app.prisma.user.update({ where: { id: userId }, data: { avatarUrl: storedAvatar.avatarUrl } });
      databaseUpdateCommitted = true;
      const committedUser = await app.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
      if (committedUser?.avatarUrl !== storedAvatar.avatarUrl) {
        await removeLocalAvatar(storedAvatar.avatarUrl, app.config.avatarUploadDir);
        throw new ConflictError('Avatar was replaced concurrently.');
      }
    } catch (error) {
      if (!databaseUpdateCommitted) {
        await removeLocalAvatar(storedAvatar.avatarUrl, app.config.avatarUploadDir);
      }
      throw error;
    }
    try {
      await removeLocalAvatar(previousAvatarUrl, app.config.avatarUploadDir);
    } catch (error) {
      request.log.warn({ error, userId }, 'Failed to remove replaced local avatar');
    }

    return { avatarUrl: storedAvatar.avatarUrl };
  });
}
