import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { describe, expect, test, vi } from 'vitest';
import { notificationRoutes } from './notifications.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { encodeSession } from '../services/session.js';
import { loadConfig } from '../config.js';

const me = { id: 'me', sessionVersion: 1 };
const authUser = { id: 'me', displayName: 'Me', avatarUrl: null, sessionVersion: 1, authProvider: 'password', emailVerifiedAt: new Date('2025-01-02') };

async function makeApp() {
  const app = Fastify();
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(authUser as never);
  vi.spyOn(prisma.notification, 'findMany').mockResolvedValue([] as never);
  vi.spyOn(prisma.notification, 'count').mockResolvedValue(0 as never);
  const deleteOne = vi.spyOn(prisma.notification, 'deleteMany').mockResolvedValue({ count: 1 } as never);
  app.decorate('prisma', prisma);
  await app.register(cookie, { secret: 'test-cookie-signing-key' });
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });
  app.decorate('config', config);
  registerHttpErrorHandler(app);
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  const cookies = { [config.session.cookieName]: app.signCookie(encodeSession({ userId: me.id, sessionVersion: me.sessionVersion, issuedAt: Date.now(), expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config)) };
  return { app, cookies, deleteOne };
}

describe('notification routes', () => {
  test('DELETE /:id removes a single notification scoped to the caller', async () => {
    const { app, cookies, deleteOne } = await makeApp();
    const response = await app.inject({ method: 'DELETE', url: '/api/notifications/n1', cookies });
    expect(response.statusCode).toBe(200);
    expect(deleteOne).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'me' } });
  });

  test('DELETE / removes all notifications for the caller', async () => {
    const { app, cookies, deleteOne } = await makeApp();
    const response = await app.inject({ method: 'DELETE', url: '/api/notifications', cookies });
    expect(response.statusCode).toBe(200);
    expect(deleteOne).toHaveBeenCalledWith({ where: { userId: 'me' } });
  });
});
