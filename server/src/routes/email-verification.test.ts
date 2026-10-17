import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { createDeterministicLimiterStore } from '../services/rate-limit.js';
import type { LimiterStore } from '../services/rate-limit.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { authRoutes } from './auth.js';
import { authenticate } from '../middleware/auth.js';
import { encodeSession } from '../services/session.js';

const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/guessit', SESSION_SECRET: 'v'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });

const pendingUser = {
  id: 'pending-user', displayName: 'Pending', email: 'pending@example.com', authProvider: 'password' as const, passwordHash: 'scrypt$16384$8$1$CKdn-JLRhf_1vshvyI2ivQ$HgY6NGazEGJ6xCKVC8tWUSLurTLTfGimAYnFxN_jdUaQ00kLV4lGUuU1bWZ6KrvonFMABBo5608uu1VJXneTdw',
  hackclubId: null, bio: null, avatarUrl: null, usernameChosen: true, isDeveloper: false, isOwner: false,
  failedLoginAttempts: 0, lockedUntil: null, sessionVersion: 1, emailVerifiedAt: null, createdAt: new Date('2026-01-01'),
};

async function makeApp(foundUser: typeof pendingUser | null, validToken = false, limiterStore: LimiterStore = createDeterministicLimiterStore(), protectedRoute = false) {
  const app = Fastify();
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(foundUser);
  vi.spyOn(prisma.user, 'update').mockResolvedValue(foundUser ?? pendingUser);
  vi.spyOn(prisma.emailVerificationToken, 'create').mockResolvedValue({ id: 'token', userId: 'pending-user', tokenHash: 'hash', expiresAt: new Date(), usedAt: null, createdAt: new Date() });
  vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback({ emailVerificationToken: { findFirst: vi.fn().mockResolvedValue(validToken ? { id: 'token', userId: 'pending-user' } : null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, user: { update: vi.fn() } } as never));
  app.decorate('config', config);
  app.decorate('prisma', prisma);
  app.decorate('limiterStore', limiterStore);
  await app.register(cookie, { secret: config.sessionSecret });
  registerHttpErrorHandler(app);
  await app.register(authRoutes, { prefix: '/auth' });
  if (protectedRoute) app.get('/protected', { preHandler: [authenticate] }, async () => ({ ok: true }));
  return app;
}

describe('email verification routes', () => {
  it('keeps resend generic for an unknown account', async () => {
    const response = await (await makeApp(null)).inject({ method: 'POST', url: '/auth/resend-verification', payload: { email: 'missing@example.com' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'If an account is eligible, a verification email is on its way.' });
    expect(response.body).not.toContain('missing@example.com');
  });

  it('does not create a session when a pending password account logs in', async () => {
    const response = await (await makeApp(pendingUser)).inject({ method: 'POST', url: '/auth/login', payload: { email: pendingUser.email, password: 'correct-password' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({ pendingVerification: true }));
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('does not echo a verification token on invalid verification requests', async () => {
    const token = 'raw-verification-token';
    const response = await (await makeApp(null)).inject({ method: 'GET', url: `/auth/verify-email?token=${token}` });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(token);
  });

  it('redirects successful verification without exposing the token', async () => {
    const token = 'raw-verification-token';
    const response = await (await makeApp(null, true)).inject({ method: 'GET', url: `/auth/verify-email?token=${token}` });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${config.appUrl}/verify-email?verified=1`);
    expect(response.headers.location).not.toContain(token);
    expect(response.body).not.toContain(token);
  });

  it('issues a pending Hack Club session that protected middleware rejects', async () => {
    const app = await makeApp(pendingUser, false, createDeterministicLimiterStore(), true);
    vi.spyOn(app.prisma.user, 'upsert').mockResolvedValue({ ...pendingUser, email: null, authProvider: 'hackclub', hackclubId: 'hc-1' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 'access' }), { status: 200 });
      return new Response(JSON.stringify({ sub: 'hc-1', email: null }), { status: 200 });
    });
    const state = 'oauth-state';
    const response = await app.inject({
      method: 'GET',
      url: '/auth/hackclub/callback?code=code&state=' + state,
      headers: { cookie: `oauth_state=${app.signCookie(state)}; oauth_mode=${app.signCookie('login')}` },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${config.appUrl}/profile?pendingEmail=1`);
    const sessionCookie = String(response.headers['set-cookie']).match(/guessit_session=[^;]+/)?.[0];
    expect(sessionCookie).toBeDefined();
    const protectedResponse = await app.inject({ method: 'GET', url: '/protected', headers: { cookie: sessionCookie } });
    expect(protectedResponse.statusCode).toBe(403);
    expect(protectedResponse.body).toContain('EMAIL_VERIFICATION_REQUIRED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it('blocks repeated pending email updates by account-scoped limiter', async () => {
    const calls: string[] = [];
    const limiterStore: LimiterStore = { consume: async (input) => {
      calls.push(input.key);
      const accountAttempt = calls.filter((key) => key.startsWith('verification-email-user:')).length;
      const allowed = input.key.startsWith('verification-email-user:') ? accountAttempt === 1 : true;
      return { allowed, remaining: 0, resetAtMs: input.nowMs + input.windowMs };
    } };
    const app = await makeApp(pendingUser, false, limiterStore);
    const payload = { userId: pendingUser.id, sessionVersion: pendingUser.sessionVersion, issuedAt: Date.now(), expiresAt: Date.now() + 60_000 };
    const cookieValue = app.signCookie(encodeSession(payload, config));
    const headers = { cookie: `${config.session.cookieName}=${cookieValue}` };
    const first = await app.inject({ method: 'PATCH', url: '/auth/verification-email', headers, payload: { email: 'new@example.com' } });
    const second = await app.inject({ method: 'PATCH', url: '/auth/verification-email', headers, payload: { email: 'new@example.com' } });
    expect(first.statusCode).toBe(503);
    expect(second.statusCode).toBe(429);
    expect(calls.filter((key) => key.startsWith('verification-email-user:'))).toHaveLength(2);
  });
});
