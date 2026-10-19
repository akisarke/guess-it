import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { describe, expect, test, vi } from 'vitest';
import { userRoutes } from './users.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { encodeSession } from '../services/session.js';
import { loadConfig } from '../config.js';

const record = {
  id: 'public-user',
  displayName: 'Ada',
  email: 'ada@example.com',
  authProvider: 'password' as const,
  hackclubId: 'hc-private',
  bio: 'Bio',
  avatarUrl: '/avatars/ada.png',
  usernameChosen: true,
  isDeveloper: true,
  isOwner: true,
  createdAt: new Date('2025-01-01'),
  passwordHash: null,
  sessionVersion: 1,
  failedLoginAttempts: 0,
  lockedUntil: null,
  emailVerifiedAt: null,
};

async function makeApp(userRecord: typeof record | null = record) {
  const app = Fastify();
  const prisma = new PrismaClient();
  const authUser = { ...record, emailVerifiedAt: new Date('2025-01-02') };
  const findUnique = vi.spyOn(prisma.user, 'findUnique');
  findUnique.mockResolvedValueOnce(authUser).mockResolvedValue(userRecord);
  vi.spyOn(prisma.streak, 'findUnique').mockResolvedValue(null);
  vi.spyOn(prisma.userBadge, 'findMany').mockResolvedValue([]);
  vi.spyOn(prisma.questionSet, 'findMany').mockResolvedValue([]);
  app.decorate('prisma', prisma);
  await app.register(cookie, { secret: 'test-cookie-signing-key' });
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });
  app.decorate('config', config);
  registerHttpErrorHandler(app);
  await app.register(userRoutes, { prefix: '/users' });
  const cookies = { [config.session.cookieName]: app.signCookie(encodeSession({ userId: authUser.id, sessionVersion: authUser.sessionVersion, issuedAt: Date.now(), expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config)) };
  return { app, cookies };
}

describe('profile projections', () => {
  test('public profile returns approved fields only', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'GET', url: '/users/public-user/profile', cookies });

    expect(response.statusCode).toBe(200);
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'public-user' },
      select: { id: true, displayName: true, bio: true, avatarUrl: true, isDeveloper: true, createdAt: true },
    });
    expect(response.json().user).toEqual({
      id: 'public-user',
      displayName: 'Ada',
      bio: 'Bio',
      avatarUrl: '/avatars/ada.png',
      isDeveloper: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
  });

  test('public profile lookup by handle uses the public projection', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'GET', url: '/users/handle/Ada/profile', cookies });

    expect(response.statusCode).toBe(200);
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { displayName: 'Ada' },
      select: { id: true, displayName: true, bio: true, avatarUrl: true, isDeveloper: true, createdAt: true },
    });
    expect(response.json().user).toEqual({
      id: 'public-user',
      displayName: 'Ada',
      bio: 'Bio',
      avatarUrl: '/avatars/ada.png',
      isDeveloper: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
  });

  test('public profile lookup by unknown handle returns 404', async () => {
    const { app, cookies } = await makeApp(null);

    const response = await app.inject({ method: 'GET', url: '/users/handle/missing/profile', cookies });

    expect(response.statusCode).toBe(404);
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { displayName: 'missing' },
      select: { id: true, displayName: true, bio: true, avatarUrl: true, isDeveloper: true, createdAt: true },
    });
  });

  test('public profile lookup rejects malformed handles without querying Prisma', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'GET', url: '/users/handle/a/profile', cookies });

    expect(response.statusCode).toBe(400);
    expect(app.prisma.user.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { displayName: 'a' } }));
  });

});
