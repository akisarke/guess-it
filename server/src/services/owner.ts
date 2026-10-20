import { getSessionUser } from '../middleware/auth.js';
import type { FastifyRequest } from 'fastify';
import { AuthenticationError, AuthorizationError } from '../errors/application-error.js';

export function canManageOwnerTools(user: { isOwner: boolean }): boolean {
  return user.isOwner;
}

export async function requireOwner(request: FastifyRequest) {
  const user = await getSessionUser(request);
  if (!user) throw new AuthenticationError('Not authenticated');
  if (!canManageOwnerTools(user)) throw new AuthorizationError('Owner access required');
  request.userId = user.id;
  request.session = { userId: user.id, sessionVersion: user.sessionVersion, issuedAt: 1, expiresAt: Number.MAX_SAFE_INTEGER };
}
