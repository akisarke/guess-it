import { describe, expect, test } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { loadConfig } from '../config.js';
import { setSessionCookie } from './auth-helpers.js';
import { decodeSession, encodeSession, type SessionData } from './session.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/guessit',
  SESSION_SECRET: 't'.repeat(64),
  CLIENT_ORIGINS: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
  TRUST_PROXY: 'loopback',
  HACKCLUB_CLIENT_ID: 'test',
  HACKCLUB_CLIENT_SECRET: 's'.repeat(32),
  HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback',
});

const session: SessionData = {
  userId: 'user-1',
  sessionVersion: 4,
  issuedAt: 1_000,
  expiresAt: 1_000 + 30 * 24 * 60 * 60 * 1_000,
};

describe('session codec', () => {
  test('round-trips the complete typed payload', () => {
    const encoded = encodeSession(session, config);

    expect(decodeSession(encoded, session.issuedAt + 1, config)).toEqual(session);
  });

  test('rejects an expired payload', () => {
    const encoded = encodeSession(session, config);

    expect(decodeSession(encoded, session.expiresAt + 1, config)).toBeNull();
  });

  test('rejects a tampered payload', () => {
    const encoded = encodeSession(session, config);
    const tampered = `${encoded}x`;

    expect(decodeSession(tampered, session.issuedAt + 1, config)).toBeNull();
  });

  test.each([
    { issuedAt: 0, expiresAt: 2_000 },
    { issuedAt: Number.NaN, expiresAt: 2_000 },
    { issuedAt: 1_000, expiresAt: Number.POSITIVE_INFINITY },
    { issuedAt: 2_000, expiresAt: 1_000 },
  ])('rejects invalid timestamps', (timestamps) => {
    const encoded = encodeSession({ ...session, ...timestamps }, config);

    expect(decodeSession(encoded, session.issuedAt + 1, config)).toBeNull();
  });
});

test('issues the explicit typed cookie policy', async () => {
  const app = Fastify();
  await app.register(cookie, { secret: config.sessionSecret });
  app.get('/', async (_request, reply) => {
    setSessionCookie(reply, session.userId, session.sessionVersion, config);
    return { ok: true };
  });

  const response = await app.inject({ method: 'GET', url: '/' });
  const cookieHeader = response.headers['set-cookie'];
  expect(cookieHeader).toContain(`${config.session.cookieName}=`);
  expect(cookieHeader).toContain('HttpOnly');
  expect(cookieHeader).toContain('Path=/');
  expect(cookieHeader).toContain('Max-Age=2592000');
  expect(cookieHeader).toContain('SameSite=Lax');
});
