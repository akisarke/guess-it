import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDeterministicLimiterStore } from './services/rate-limit.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/guessit',
  SESSION_SECRET: 'injected-session-secret-that-is-not-a-default-value',
  CLIENT_ORIGINS: 'https://test.example.test',
  APP_URL: 'https://test.example.test',
  TRUST_PROXY: 'loopback',
  HACKCLUB_CLIENT_ID: 'test-client',
  HACKCLUB_CLIENT_SECRET: 'test-client-secret',
  HACKCLUB_REDIRECT_URI: 'https://test.example.test/callback',
  AVATAR_UPLOAD_DIR: 'test-uploads/avatars',
});

describe('buildApp configuration boundary', () => {
  it('uses injected origin and session secret', async () => {
    const prisma = new PrismaClient();
     const app = await buildApp({ config, prisma, logger: false, limiterStore: createDeterministicLimiterStore() });
    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/puzzle/archive',
        headers: { origin: 'https://test.example.test', 'access-control-request-method': 'GET' },
      });

      expect(response.headers['access-control-allow-origin']).toBe('https://test.example.test');
      const signed = app.signCookie('session-value');
      expect(app.unsignCookie(signed)).toMatchObject({ valid: true, value: 'session-value' });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['permissions-policy']).toContain('camera=()');
    } finally {
      await app.close();
    }
  });

  it('issues a browser-readable signed CSRF token without requiring a session', async () => {
    const app = await buildApp({ config, logger: false, limiterStore: createDeterministicLimiterStore() });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ csrfToken: expect.any(String) });
      expect(String(response.headers['set-cookie'])).toContain('guessit_csrf=');
    } finally {
      await app.close();
    }
  });

  it('rejects a production app without an injected shared limiter store', async () => {
    const production = loadConfig({
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://db.example.test:5432/guessit', SESSION_SECRET: 'p'.repeat(64),
      SESSION_COOKIE_SAME_SITE: 'lax',
      CLIENT_ORIGINS: 'https://test.example.test', APP_URL: 'https://test.example.test', TRUST_PROXY: '10.0.0.0/8',
      HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 'p'.repeat(32), HACKCLUB_REDIRECT_URI: 'https://test.example.test/callback',
    ...Object.fromEntries(['LOGIN_IP','LOGIN_ACCOUNT','ANONYMOUS_IP','FORGOT_PASSWORD_IP','FORGOT_PASSWORD_ACCOUNT','RESET_PASSWORD_IP','RESET_PASSWORD_TOKEN_PREFIX','SIGNUP_IP','GENERATION_IP','GENERATION_USER','AVATAR_IP','AVATAR_USER'].map((name) => [`LIMIT_${name}`, '1:60000'])),
      DUEL_MAX_PAYLOAD_BYTES: '16384', DUEL_COMMAND_LIMIT: '20', DUEL_COMMAND_WINDOW_MS: '10000',
    });
    await expect(buildApp({ config: production, logger: false })).rejects.toThrow('Limiter store is required in production');
  });
});
