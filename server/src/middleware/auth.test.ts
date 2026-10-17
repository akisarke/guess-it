import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { describe, expect, test, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../config.js';
import { authenticate, getSessionUser, requireRegistered } from './auth.js';
import { encodeSession } from '../services/session.js';

const config = loadConfig({
  NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/guessit', SESSION_SECRET: 't'.repeat(64),
  CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', TRUST_PROXY: 'loopback',
  HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback',
});

async function makeApp(user: { id: string; sessionVersion: number; emailVerifiedAt?: Date | null; authProvider?: 'password' | 'anonymous' } | null) {
  const app = Fastify();
  await app.register(cookie, { secret: config.sessionSecret });
  app.decorate('config', config);
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(user ? {
     ...user, displayName: 'User', authProvider: user.authProvider ?? 'password', email: null, passwordHash: null,
    hackclubId: null, bio: null, avatarUrl: null, usernameChosen: true, isDeveloper: false,
     isOwner: false, failedLoginAttempts: 0, lockedUntil: null, emailVerifiedAt: user.emailVerifiedAt ?? null, createdAt: new Date(),
  } : null);
  app.decorate('prisma', prisma);
  app.get('/', async (request) => getSessionUser(request));
  return app;
}

describe('session middleware', () => {
  test('rejects a valid session when the user no longer exists', async () => {
    const app = await makeApp(null);
    const payload = { userId: 'missing', sessionVersion: 0, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 };
    const value = app.signCookie(encodeSession(payload, config));

    expect((await app.inject({ method: 'GET', url: '/', headers: { cookie: `${config.session.cookieName}=${value}` } })).json()).toBeNull();
  });

  test('rejects a session with a stale user version', async () => {
    const app = await makeApp({ id: 'user-1', sessionVersion: 2 });
    const payload = { userId: 'user-1', sessionVersion: 1, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 };
    const value = app.signCookie(encodeSession(payload, config));

    expect((await app.inject({ method: 'GET', url: '/', headers: { cookie: `${config.session.cookieName}=${value}` } })).json()).toBeNull();
  });

  test('rejects pending non-anonymous sessions on protected requests', async () => {
    const app = await makeApp({ id: 'user-1', sessionVersion: 2 });
    app.get('/protected', { preHandler: [authenticate] }, async () => ({ ok: true }));
    const payload = { userId: 'user-1', sessionVersion: 2, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 };
    const value = app.signCookie(encodeSession(payload, config));
    const response = await app.inject({ method: 'GET', url: '/protected', headers: { cookie: `${config.session.cookieName}=${value}` } });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(expect.objectContaining({ code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Email verification is required.' }));
  });

  test('allows grandfathered users with a verification timestamp', async () => {
    const app = await makeApp({ id: 'user-1', sessionVersion: 2, emailVerifiedAt: new Date('2025-01-01') });
    app.get('/protected', { preHandler: [authenticate] }, async () => ({ ok: true }));
    const payload = { userId: 'user-1', sessionVersion: 2, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 };
    const value = app.signCookie(encodeSession(payload, config));
    expect((await app.inject({ method: 'GET', url: '/protected', headers: { cookie: `${config.session.cookieName}=${value}` } })).statusCode).toBe(200);
  });

  test('rejects anonymous sessions from registered-only routes', async () => {
    const app = await makeApp({ id: 'anon-1', sessionVersion: 0, authProvider: 'anonymous', emailVerifiedAt: null });
    app.get('/registered-only', { preHandler: [authenticate, requireRegistered] }, async () => ({ ok: true }));
    const payload = { userId: 'anon-1', sessionVersion: 0, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 };
    const value = app.signCookie(encodeSession(payload, config));
    const response = await app.inject({ method: 'GET', url: '/registered-only', headers: { cookie: `${config.session.cookieName}=${value}` } });
    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe('Create an account to use this feature.');
  });
});
