import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { describe, expect, test, vi } from 'vitest';
import { friendRoutes } from './friends.js';
import { registerHttpErrorHandler } from '../errors/http-error-handler.js';
import { encodeSession } from '../services/session.js';
import { loadConfig } from '../config.js';

const me = { id: 'me', sessionVersion: 1 };
const other = { id: 'them', displayName: 'Ada', avatarUrl: null };
const authUser = { id: 'me', displayName: 'Me', avatarUrl: null, sessionVersion: 1, authProvider: 'password', emailVerifiedAt: new Date('2025-01-02') };

function userLookup(routeResult: unknown = other) {
  return async (args: { where: Record<string, unknown> }) =>
    typeof args?.where?.id === 'string' ? authUser : routeResult;
}

async function makeApp() {
  const app = Fastify();
  const prisma = new PrismaClient();
  vi.spyOn(prisma.user, 'findUnique').mockImplementation(userLookup() as never);
  vi.spyOn(prisma.friendRequest, 'findMany').mockResolvedValue([] as never);
  vi.spyOn(prisma.friendRequest, 'findFirst').mockResolvedValue(null as never);
  vi.spyOn(prisma.friendRequest, 'findUnique').mockResolvedValue(null as never);
  vi.spyOn(prisma.friendRequest, 'create').mockResolvedValue({} as never);
  vi.spyOn(prisma.friendRequest, 'update').mockResolvedValue({} as never);
  vi.spyOn(prisma.friendRequest, 'delete').mockResolvedValue({} as never);
  vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as never);
  app.decorate('prisma', prisma);
  await app.register(cookie, { secret: 'test-cookie-signing-key' });
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });
  app.decorate('config', config);
  registerHttpErrorHandler(app);
  await app.register(friendRoutes, { prefix: '/friends' });
  const cookies = { [config.session.cookieName]: app.signCookie(encodeSession({ userId: me.id, sessionVersion: me.sessionVersion, issuedAt: Date.now(), expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config)) };
  return { app, cookies };
}

describe('friends routes', () => {
  test('GET partitions rows into friends, incoming and outgoing', async () => {
    const { app, cookies } = await makeApp();
    const rows = [
      { id: 'r1', senderId: 'me', receiverId: 'them', status: 'accepted', sender: { id: 'me', displayName: 'Me', avatarUrl: null }, receiver: other },
      { id: 'r2', senderId: 'them', receiverId: 'me', status: 'pending', sender: other, receiver: { id: 'me', displayName: 'Me', avatarUrl: null } },
      { id: 'r3', senderId: 'me', receiverId: 'other2', status: 'pending', sender: { id: 'me', displayName: 'Me', avatarUrl: null }, receiver: { id: 'other2', displayName: 'Lin', avatarUrl: null } },
    ];
    vi.mocked(app.prisma.friendRequest.findMany).mockResolvedValue(rows as never);

    const response = await app.inject({ method: 'GET', url: '/friends', cookies });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      friends: [{ requestId: 'r1', user: other }],
      incoming: [{ requestId: 'r2', user: other }],
      outgoing: [{ requestId: 'r3', user: { id: 'other2', displayName: 'Lin', avatarUrl: null } }],
    });
  });

  test('POST creates a request toward the named player', async () => {
    const { app, cookies } = await makeApp();

    const response = await app.inject({ method: 'POST', url: '/friends', cookies, payload: { displayName: 'Ada' } });

    expect(response.statusCode).toBe(201);
    expect(app.prisma.friendRequest.create).toHaveBeenCalledWith({ data: { senderId: 'me', receiverId: 'them' } });
    expect(app.prisma.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'them', type: 'friend_request', actionUrl: '/profile' }) });
  });

  test('POST rejects friending yourself', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.user.findUnique).mockImplementation(userLookup({ id: 'me' }) as never);

    const response = await app.inject({ method: 'POST', url: '/friends', cookies, payload: { displayName: 'Me' } });

    expect(response.statusCode).toBe(400);
    expect(app.prisma.friendRequest.create).not.toHaveBeenCalled();
  });

  test('POST rejects an existing request between the pair', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.friendRequest.findFirst).mockResolvedValue({ id: 'r0', status: 'pending' } as never);

    const response = await app.inject({ method: 'POST', url: '/friends', cookies, payload: { displayName: 'Ada' } });

    expect(response.statusCode).toBe(409);
    expect(app.prisma.friendRequest.create).not.toHaveBeenCalled();
  });

  test('accept requires the receiver', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.friendRequest.findUnique).mockResolvedValue({ id: 'r1', status: 'pending', senderId: 'them', receiverId: 'someone-else' } as never);

    const response = await app.inject({ method: 'POST', url: '/friends/r1/accept', cookies });

    expect(response.statusCode).toBe(404);
    expect(app.prisma.friendRequest.update).not.toHaveBeenCalled();
  });

  test('accept by the receiver marks it accepted', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.friendRequest.findUnique).mockResolvedValue({ id: 'r1', status: 'pending', senderId: 'them', receiverId: 'me' } as never);

    const response = await app.inject({ method: 'POST', url: '/friends/r1/accept', cookies });

    expect(response.statusCode).toBe(200);
    expect(app.prisma.friendRequest.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'accepted' } });
  });

  test('DELETE refuses a row the caller is not part of', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.friendRequest.findUnique).mockResolvedValue({ id: 'r1', status: 'accepted', senderId: 'them', receiverId: 'someone-else' } as never);

    const response = await app.inject({ method: 'DELETE', url: '/friends/r1', cookies });

    expect(response.statusCode).toBe(404);
    expect(app.prisma.friendRequest.delete).not.toHaveBeenCalled();
  });

  test('DELETE removes a row between the caller and their friend', async () => {
    const { app, cookies } = await makeApp();
    vi.mocked(app.prisma.friendRequest.findUnique).mockResolvedValue({ id: 'r1', status: 'accepted', senderId: 'me', receiverId: 'them' } as never);

    const response = await app.inject({ method: 'DELETE', url: '/friends/r1', cookies });

    expect(response.statusCode).toBe(200);
    expect(app.prisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
});
