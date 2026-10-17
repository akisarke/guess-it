import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { describe, expect, test, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { authRoutes } from './auth.js';
import { createDeterministicLimiterStore } from '../services/rate-limit.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';

const config = loadConfig({
  NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/guessit', SESSION_SECRET: 't'.repeat(64),
  CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', TRUST_PROXY: 'loopback',
  HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback',
});

const passwordHash = 'scrypt$16384$8$1$CKdn-JLRhf_1vshvyI2ivQ$HgY6NGazEGJ6xCKVC8tWUSLurTLTfGimAYnFxN_jdUaQ00kLV4lGUuU1bWZ6KrvonFMABBo5608uu1VJXneTdw';

function user(overrides: Partial<{
  id: string; email: string | null; passwordHash: string | null; failedLoginAttempts: number; lockedUntil: Date | null; sessionVersion: number;
}> = {}) {
  return {
  id: 'user-1', displayName: 'User', email: 'user@example.com', authProvider: 'password' as const, passwordHash,
    hackclubId: null, bio: null, avatarUrl: null, usernameChosen: true, isDeveloper: false,
    isOwner: false, failedLoginAttempts: 0, lockedUntil: null, sessionVersion: 4, emailVerifiedAt: new Date('2025-01-01'), createdAt: new Date('2025-01-01'), ...overrides,
  };
}

async function makeApp(foundUser: ReturnType<typeof user> | null) {
  const app = Fastify();
  await app.register(cookie, { secret: config.sessionSecret });
  app.decorate('config', config);
  app.decorate('limiterStore', createDeterministicLimiterStore());
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(foundUser);
  vi.spyOn(prisma.user, 'update').mockResolvedValue(foundUser ?? user());
  vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ failedLoginAttempts: 10, lockedUntil: new Date('2025-01-01T00:15:00.000Z') }]);
  app.decorate('prisma', prisma);
  registerHttpErrorHandler(app);
  await app.register(authRoutes, { prefix: '/auth' });
  return app;
}

describe('password login lockout', () => {
  test('uses the same generic 401 for unknown and invalid credentials', async () => {
    const unknown = await (await makeApp(null)).inject({ method: 'POST', url: '/auth/login', payload: { email: 'missing@example.com', password: 'wrong-password' } });
    const invalid = await (await makeApp(user())).inject({ method: 'POST', url: '/auth/login', payload: { email: 'user@example.com', password: 'wrong-password' } });

    expect(unknown.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
    expect(unknown.json()).toEqual(invalid.json());
  });

  test('records a tenth invalid password atomically and locks for fifteen minutes', async () => {
    const app = await makeApp(user({ failedLoginAttempts: 9 }));
    const queryRaw = vi.mocked(app.prisma.$queryRaw);

    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'user@example.com', password: 'wrong-password' } });

    expect(response.statusCode).toBe(401);
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  test('returns generic 401 when an active lock wins the failed-login update race', async () => {
    const app = await makeApp(user());
    vi.mocked(app.prisma.$queryRaw).mockResolvedValue([]);

    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'user@example.com', password: 'wrong-password' } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Incorrect email or password.', code: 'AUTHENTICATION_REQUIRED' });
  });

  test('denies an active lock before password verification with the generic 401', async () => {
    const app = await makeApp(user({ lockedUntil: new Date(Date.now() + 60_000) }));
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'user@example.com', password: 'correct-password' } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Incorrect email or password.', code: 'AUTHENTICATION_REQUIRED' });
  });

  test('clears failure state and issues a session cookie with the current version after success', async () => {
    const app = await makeApp(user({ failedLoginAttempts: 3, lockedUntil: new Date(Date.now() - 60_000) }));
    const update = vi.mocked(app.prisma.user.update);
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'user@example.com', password: 'correct-password' } });

    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { failedLoginAttempts: 0, lockedUntil: null } }));
    expect(response.headers['set-cookie']).toEqual(expect.stringContaining('guessit_session='));
    expect(response.json().user).toEqual(expect.objectContaining({ email: 'user@example.com', authProvider: 'password', usernameChosen: true, isOwner: false }));
  });
});
