import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { describe, expect, test, vi } from 'vitest';
import { matchmakingRoutes } from './matchmaking.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { encodeSession } from '../services/session.js';
import { loadConfig } from '../config.js';

vi.mock('../services/duels/repository.js', () => ({ loadDuelState: vi.fn().mockResolvedValue(null) }));

const me = { id: 'me', sessionVersion: 1 };
const authUser = { id: 'me', displayName: 'Me', avatarUrl: null, sessionVersion: 1, authProvider: 'password', emailVerifiedAt: new Date('2025-01-02') };
const friend = { id: 'them', displayName: 'Ada', avatarUrl: null, authProvider: 'password' };

function userLookup() {
  return async (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
    const user = args?.where?.id === 'me' ? authUser : friend;
    if (!args?.select) return user;
    return Object.fromEntries(Object.keys(args.select).map((key) => [key, (user as Record<string, unknown>)[key]]));
  };
}

function waitingDuel(overrides: Record<string, unknown> = {}) {
  return { id: 'd1', playerA: 'them', playerB: 'me', status: 'waiting', inviteExpiresAt: new Date(Date.now() + 60_000), ...overrides };
}

async function makeApp() {
  const app = Fastify();
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockImplementation(userLookup() as never);
  vi.spyOn(prisma.friendRequest, 'findFirst').mockResolvedValue(null as never);
  vi.spyOn(prisma.dailyPuzzle, 'findFirst').mockResolvedValue({ id: 'p1' } as never);
  vi.spyOn(prisma.duel, 'create').mockResolvedValue({ id: 'd1' } as never);
  vi.spyOn(prisma.duel, 'findUnique').mockResolvedValue(null as never);
  vi.spyOn(prisma.duel, 'updateMany').mockResolvedValue({ count: 1 } as never);
  vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as never);
  app.decorate('prisma', prisma);
  app.decorate('duelCoordinator', { register: vi.fn() } as never);
  await app.register(cookie, { secret: 'test-cookie-signing-key' });
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });
  app.decorate('config', config);
  registerHttpErrorHandler(app);
  await app.register(matchmakingRoutes);
  const cookies = { [config.session.cookieName]: app.signCookie(encodeSession({ userId: me.id, sessionVersion: me.sessionVersion, issuedAt: Date.now(), expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config)) };
  return { app, cookies };
}

describe('duel invite', () => {
  test('rejects challenging a non-friend', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'POST', url: '/duels/invite', cookies, payload: { targetUserId: 'them' } });

    expect(response.statusCode).toBe(400);
    expect(app.prisma.duel.create).not.toHaveBeenCalled();
  });

  test('creates the duel and notifies both players', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.friendRequest.findFirst).mockResolvedValue({ id: 'fr1', status: 'accepted' } as never);

    const response = await app.inject({ method: 'POST', url: '/duels/invite', cookies, payload: { targetUserId: 'them' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ duelId: 'd1', token: expect.any(String) });
    expect(app.prisma.duel.create).toHaveBeenCalledWith({ data: expect.objectContaining({ playerA: 'me', playerB: 'them', sourceKind: 'daily' }) });
    expect(app.prisma.notification.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ userId: 'them', type: 'duel_invite' }) });
    expect(app.prisma.notification.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ userId: 'me', type: 'duel_invite' }) });
  });
});

describe('GET /duels/challenge/:token', () => {
  test('returns waiting state for the invited player', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel() as never);

    const response = await app.inject({ method: 'GET', url: '/duels/challenge/tok', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: 'waiting', duelId: 'd1', you: 'B', opponent: { id: 'them', displayName: 'Ada', avatarUrl: null } });
  });

  test('404s on an unknown token', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'GET', url: '/duels/challenge/nope', cookies });

    expect(response.statusCode).toBe(404);
  });

  test('404s for a player not in the duel', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel({ playerA: 'x', playerB: 'y' }) as never);

    const response = await app.inject({ method: 'GET', url: '/duels/challenge/tok', cookies });

    expect(response.statusCode).toBe(404);
  });

  test('reports expired invites', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel({ inviteExpiresAt: new Date(Date.now() - 1000) }) as never);

    const response = await app.inject({ method: 'GET', url: '/duels/challenge/tok', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ state: 'expired', duelId: 'd1' });
  });

  test('reports started duels', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel({ status: 'question' }) as never);

    const response = await app.inject({ method: 'GET', url: '/duels/challenge/tok', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ state: 'started', duelId: 'd1' });
  });
});

describe('POST /duels/challenge/:token/accept', () => {
  test('starts the duel for the invited player', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel() as never);

    const response = await app.inject({ method: 'POST', url: '/duels/challenge/tok/accept', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ duelId: 'd1' });
    expect(app.prisma.duel.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', status: 'waiting' },
      data: expect.objectContaining({ status: 'question', roundStartedAt: expect.any(Date), roundDeadlineAt: expect.any(Date) }),
    });
  });

  test('rejects the inviter (player A)', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel({ playerA: 'me', playerB: 'them' }) as never);

    const response = await app.inject({ method: 'POST', url: '/duels/challenge/tok/accept', cookies });

    expect(response.statusCode).toBe(403);
    expect(app.prisma.duel.updateMany).not.toHaveBeenCalled();
  });

  test('rejects an expired invite with 409', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel({ inviteExpiresAt: new Date(Date.now() - 1000) }) as never);

    const response = await app.inject({ method: 'POST', url: '/duels/challenge/tok/accept', cookies });

    expect(response.statusCode).toBe(409);
    expect(app.prisma.duel.updateMany).not.toHaveBeenCalled();
  });

  test('re-accepting an already-started duel is idempotent', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.duel.findUnique).mockResolvedValue(waitingDuel({ status: 'question' }) as never);

    const response = await app.inject({ method: 'POST', url: '/duels/challenge/tok/accept', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ duelId: 'd1' });
    expect(app.prisma.duel.updateMany).not.toHaveBeenCalled();
  });

  test('404s on an unknown token', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'POST', url: '/duels/challenge/nope/accept', cookies });

    expect(response.statusCode).toBe(404);
    expect(app.prisma.duel.updateMany).not.toHaveBeenCalled();
  });
});
