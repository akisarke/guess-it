import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { createDeterministicLimiterStore } from '../services/rate-limit.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { authRoutes } from './auth.js';
import { encodeSession } from '../services/session.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/guessit',
  SESSION_SECRET: 'v'.repeat(64),
  CLIENT_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TRUST_PROXY: 'loopback',
  HACKCLUB_CLIENT_ID: 'test',
  HACKCLUB_CLIENT_SECRET: 's'.repeat(32),
  HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback',
});

const hackClubUser = {
  id: 'user-1', displayName: 'hackclub-abc12345', email: 'member@example.com', authProvider: 'hackclub' as const,
  passwordHash: null, hackclubId: 'hc-1', bio: null, avatarUrl: null, usernameChosen: false,
  isDeveloper: false, isOwner: false, failedLoginAttempts: 0, lockedUntil: null,
  sessionVersion: 0, emailVerifiedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'),
};

const anonymousUser = {
  ...hackClubUser, id: 'anon-1', displayName: 'anon-c112bbd5-1f7a-4e2b', email: null,
  authProvider: 'anonymous' as const, hackclubId: null, usernameChosen: false, emailVerifiedAt: null,
};

type UserRecord = Omit<typeof hackClubUser, 'authProvider' | 'passwordHash' | 'hackclubId'> & {
  authProvider: 'hackclub' | 'password' | 'anonymous'; passwordHash: string | null; hackclubId: string | null;
};

async function makeApp(
  sessionUser: typeof hackClubUser | typeof anonymousUser | null,
  linkedHackClubUser: typeof hackClubUser | null = null,
  emailOwner: UserRecord | null = null,
) {
  const app = Fastify();
  await app.register(cookie, { secret: config.sessionSecret });
  app.decorate('config', config);
  app.decorate('limiterStore', createDeterministicLimiterStore());
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockImplementation((async ({ where }: { where: { id?: string; hackclubId?: string; email?: string } }) => {
    if (where.id && where.id === sessionUser?.id) return sessionUser;
    if (where.email && emailOwner && where.email === emailOwner.email) return emailOwner;
    if (where.hackclubId && linkedHackClubUser && where.hackclubId === linkedHackClubUser.hackclubId) return linkedHackClubUser;
    return null;
  }) as never);
  vi.spyOn(prisma.user, 'upsert').mockResolvedValue(hackClubUser);
  vi.spyOn(prisma.user, 'update').mockImplementation((async ({ where, data }: { where: { id: string }; data: object }) => {
    const base = where.id === anonymousUser.id ? anonymousUser : where.id === emailOwner?.id ? emailOwner : hackClubUser;
    return { ...base, ...data } as typeof hackClubUser;
  }) as never);
  vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback(prisma));
  app.decorate('prisma', prisma);
  registerHttpErrorHandler(app);
  await app.register(authRoutes, { prefix: '/auth' });
  return app;
}

function oauthHeaders(app: Awaited<ReturnType<typeof makeApp>>, sessionCookie?: string) {
  const state = 'oauth-state';
  return {
    cookie: [sessionCookie, `oauth_state=${app.signCookie(state)}`, `oauth_mode=${app.signCookie('login')}`].filter(Boolean).join('; '),
  };
}

function anonymousSession(app: Awaited<ReturnType<typeof makeApp>>) {
  return `guessit_session=${app.signCookie(encodeSession({
    userId: anonymousUser.id, sessionVersion: anonymousUser.sessionVersion,
    issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
  }, config))}`;
}

function mockHackClubProfile(profile: { sub: string; email: string | null }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/oauth/token')) return new Response(JSON.stringify({ access_token: 'access' }), { status: 200 });
    return new Response(JSON.stringify(profile), { status: 200 });
  });
}

describe('Hack Club login', () => {
  it('trusts the provider email and signs the member in immediately', async () => {
    const app = await makeApp(null);
    mockHackClubProfile({ sub: 'hc-1', email: 'member@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/hackclub/callback?code=code&state=oauth-state',
      headers: oauthHeaders(app),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${config.appUrl}/profile?setup=username`);
    expect(String(response.headers['set-cookie'])).toContain('guessit_session=');
    expect(app.prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ email: 'member@example.com', emailVerifiedAt: expect.any(Date) }),
      update: expect.objectContaining({ email: 'member@example.com', emailVerifiedAt: expect.any(Date) }),
    }));
  });

  it('migrates the anonymous account instead of creating a second user', async () => {
    const app = await makeApp(anonymousUser);
    mockHackClubProfile({ sub: 'hc-1', email: 'member@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/hackclub/callback?code=code&state=oauth-state',
      headers: oauthHeaders(app, anonymousSession(app)),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${config.appUrl}/profile?upgraded=1`);
    expect(String(response.headers['set-cookie'])).toContain('guessit_session=');
    expect(app.prisma.user.upsert).not.toHaveBeenCalled();
    expect(app.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: anonymousUser.id },
      data: expect.objectContaining({
        authProvider: 'hackclub', hackclubId: 'hc-1', email: 'member@example.com', emailVerifiedAt: expect.any(Date),
        usernameChosen: false,
      }),
    }));
  });

  it('moves anonymous progress into an existing Hack Club account', async () => {
    const app = await makeApp(anonymousUser, hackClubUser);
    mockHackClubProfile({ sub: 'hc-1', email: 'member@example.com' });
    vi.spyOn(app.prisma.guess, 'findMany').mockResolvedValue([{
      id: 'guess-1', userId: anonymousUser.id, questionId: 'q1',
      value: new Prisma.Decimal(50), score: new Prisma.Decimal(99.5), createdAt: new Date(),
    }]);
    vi.spyOn(app.prisma.guess, 'createMany').mockResolvedValue({ count: 1 });
    vi.spyOn(app.prisma.streak, 'findUnique').mockImplementation((async ({ where }: { where: { userId: string } }) => (
      where.userId === anonymousUser.id
        ? { userId: anonymousUser.id, currentStreak: 4, longestStreak: 9, lastPlayedOn: new Date() }
        : null
    )) as never);
    vi.spyOn(app.prisma.streak, 'create').mockResolvedValue({
      userId: hackClubUser.id, currentStreak: 4, longestStreak: 9, lastPlayedOn: new Date(),
    });
    vi.spyOn(app.prisma.userBadge, 'findMany').mockResolvedValue([{
      userId: anonymousUser.id, badgeId: 'badge-1', grantedAt: new Date(),
      grantedBy: null, note: null, isPinned: false, pinnedAt: null,
    }]);
    vi.spyOn(app.prisma.userBadge, 'createMany').mockResolvedValue({ count: 1 });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/hackclub/callback?code=code&state=oauth-state',
      headers: oauthHeaders(app, anonymousSession(app)),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${config.appUrl}/profile?upgraded=1`);
    expect(String(response.headers['set-cookie'])).toContain('guessit_session=');
    expect(app.prisma.user.upsert).not.toHaveBeenCalled();
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: hackClubUser.id },
      data: { email: 'member@example.com', emailVerifiedAt: expect.any(Date) },
    });
    expect(app.prisma.guess.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: hackClubUser.id, questionId: 'q1' })],
      skipDuplicates: true,
    });
    expect(app.prisma.streak.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: hackClubUser.id, currentStreak: 4, longestStreak: 9 }),
    });
    expect(app.prisma.userBadge.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: hackClubUser.id, badgeId: 'badge-1' })],
      skipDuplicates: true,
    });
  });

  it('links Hack Club to an existing account that already uses the same email', async () => {
    const passwordUser = {
      ...hackClubUser, id: 'password-1', displayName: 'ada', authProvider: 'password' as const,
      passwordHash: 'hash', hackclubId: null, usernameChosen: true,
    };
    const app = await makeApp(null, null, passwordUser);
    mockHackClubProfile({ sub: 'hc-1', email: 'member@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/hackclub/callback?code=code&state=oauth-state',
      headers: oauthHeaders(app),
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${config.appUrl}/profile?linked=1`);
    expect(String(response.headers['set-cookie'])).toContain('guessit_session=');
    expect(app.prisma.user.upsert).not.toHaveBeenCalled();
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: passwordUser.id },
      data: { hackclubId: 'hc-1', emailVerifiedAt: passwordUser.emailVerifiedAt },
    });
  });

  it('refuses when the email belongs to an account linked to another Hack Club account', async () => {
    const otherMember = { ...hackClubUser, id: 'user-2', hackclubId: 'hc-other' };
    const app = await makeApp(null, null, otherMember);
    mockHackClubProfile({ sub: 'hc-1', email: 'member@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/auth/hackclub/callback?code=code&state=oauth-state',
      headers: oauthHeaders(app),
    });

    expect(response.statusCode).toBe(409);
    expect(app.prisma.user.update).not.toHaveBeenCalled();
    expect(app.prisma.user.upsert).not.toHaveBeenCalled();
  });
});
