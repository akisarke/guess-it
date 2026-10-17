import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { decodeSession, type SessionData } from '../services/session.js';
import { AuthenticationError, AuthorizationError } from '../errors/application-error.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    authProvider?: string;
    session?: SessionData;
  }
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function getSessionUser(request: FastifyRequest) {
  const cookie = request.cookies[request.server.config.session.cookieName];
  if (!cookie) return null;
  const unsigned = request.unsignCookie(cookie);
  if (!unsigned.valid || !unsigned.value) return null;

  const decoded = decodeSession(unsigned.value, Date.now(), request.server.config);
  if (!decoded) return null;

  const user = await request.server.prisma.user.findUnique({ where: { id: decoded.userId } });
  return user?.sessionVersion === decoded.sessionVersion ? user : null;
}

export async function authenticate(request: FastifyRequest) {
  const user = await getSessionUser(request);
  if (!user) throw new AuthenticationError('Not authenticated');
  if (user.authProvider !== 'anonymous' && user.emailVerifiedAt === null) {
    throw new AuthorizationError('Email verification is required.', { code: 'EMAIL_VERIFICATION_REQUIRED' });
  }
  request.userId = user.id;
  request.authProvider = user.authProvider;
  const cookie = request.cookies[request.server.config.session.cookieName];
  const unsigned = cookie ? request.unsignCookie(cookie) : null;
  request.session = unsigned?.valid && unsigned.value ? decodeSession(unsigned.value, Date.now(), request.server.config) ?? undefined : undefined;
}

export async function requireRegistered(request: FastifyRequest) {
  if (!request.userId) throw new AuthenticationError('Not authenticated');
  if (request.authProvider === 'anonymous') throw new AuthorizationError('Create an account to use this feature.');
}

export async function requireDeveloper(request: FastifyRequest) {
  const user = await getSessionUser(request);
  if (!user) throw new AuthenticationError('Not authenticated');
  if (user.authProvider !== 'anonymous' && user.emailVerifiedAt === null) {
    throw new AuthorizationError('Email verification is required.', { code: 'EMAIL_VERIFICATION_REQUIRED' });
  }
  if (!user.isDeveloper) throw new AuthorizationError('Developer access required');
  request.userId = user.id;
  const cookie = request.cookies[request.server.config.session.cookieName];
  const unsigned = cookie ? request.unsignCookie(cookie) : null;
  request.session = unsigned?.valid && unsigned.value ? decodeSession(unsigned.value, Date.now(), request.server.config) ?? undefined : undefined;
}
