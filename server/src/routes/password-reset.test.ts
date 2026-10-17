import Fastify from 'fastify';
import { randomBytes } from 'node:crypto';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { createDeterministicLimiterStore, type LimiterInput, type LimiterStore } from '../services/rate-limit.js';
import { passwordResetRoutes } from './password-reset.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';

const resetToken = randomBytes(32).toString('base64url');
const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/guessit', SESSION_SECRET: 'r'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 'r'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });

const user = { id: 'user-1', displayName: 'User', email: 'user@example.com', authProvider: 'password' as const, passwordHash: 'stored-hash', hackclubId: null, bio: null, avatarUrl: null, usernameChosen: true, isDeveloper: false, isOwner: false, failedLoginAttempts: 0, lockedUntil: null, sessionVersion: 2, emailVerifiedAt: null, createdAt: new Date('2026-01-01') };

async function makeApp(store: LimiterStore = createDeterministicLimiterStore(), foundUser: typeof user | null = user, consumed = false) {
  const app = Fastify();
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(foundUser);
  vi.spyOn(prisma.passwordResetToken, 'deleteMany').mockResolvedValue({ count: 0 });
  vi.spyOn(prisma.passwordResetToken, 'create').mockResolvedValue({ id: 'token-1', userId: 'user-1', tokenHash: 'hashed', expiresAt: new Date(), usedAt: null, createdAt: new Date() });
  vi.spyOn(prisma.user, 'update').mockResolvedValue(user);
  vi.spyOn(prisma, '$transaction').mockResolvedValue(consumed);
  app.decorate('config', config);
  app.decorate('prisma', prisma);
  app.decorate('limiterStore', store);
  registerHttpErrorHandler(app);
  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(passwordResetRoutes, { prefix: '/auth' });
  return app;
}

describe('password reset routes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns a generic invalid response without echoing token or account data', async () => {
    const app = await makeApp(createDeterministicLimiterStore(), user, false);
    const response = await app.inject({ method: 'POST', url: '/auth/reset-password', payload: { token: resetToken, password: 'valid-password' } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'That reset link is invalid or expired.', code: 'VALIDATION_ERROR' });
    expect(response.body).not.toContain(resetToken);
    expect(response.body).not.toContain(user.email);
  });

  it('returns stable generic 429 reset metadata and stores only semantic token keys', async () => {
    const inputs: LimiterInput[] = [];
    let calls = 0;
    const app = await makeApp({ consume: async (input) => { inputs.push(input); calls += 1; return calls === 1 ? { allowed: true, remaining: 0, resetAtMs: 1234 } : { allowed: false, remaining: 0, resetAtMs: 1234 }; } });
    const response = await app.inject({ method: 'POST', url: '/auth/reset-password', payload: { token: resetToken, password: 'valid-password' } });
    const body = response.json();

    expect(response.statusCode).toBe(429);
    expect(body).toEqual({ error: 'Too many requests.', code: 'RATE_LIMITED', resetAtMs: 1234, resetAt: new Date(1234).toISOString() });
    expect(inputs[0]?.key).toMatch(/^reset-password-ip:/);
    expect(inputs[1]?.key).toMatch(/^reset-token:[0-9a-f]{16}$/);
    expect(response.body).not.toContain(resetToken);
  });

  it('wires a successful reset through the route without exposing the raw token', async () => {
    const app = await makeApp(createDeterministicLimiterStore(), user, true);
    const update = vi.mocked(app.prisma.user.update);
    const response = await app.inject({ method: 'POST', url: '/auth/reset-password', payload: { token: resetToken, password: 'valid-password' } });

    expect(response.statusCode).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect(response.json()).toEqual({ message: 'Your password has been reset. You can now sign in.' });
    expect(response.body).not.toContain(resetToken);
  });

  it('keeps forgot-password responses generic for missing accounts', async () => {
    const app = await makeApp(createDeterministicLimiterStore(), null);
    const response = await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email: user.email } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'If an account exists, a reset email is on its way.' });
    expect(response.body).not.toContain(user.email);
  });
});
