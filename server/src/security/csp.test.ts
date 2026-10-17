import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createDeterministicLimiterStore } from '../services/rate-limit.js';

const config = loadConfig({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/guessit',
  SESSION_SECRET: 'a-secret-that-is-long-enough-to-pass-validation-32',
  CLIENT_ORIGINS: 'https://guessit.akisarke.xyz',
  APP_URL: 'https://guessit.akisarke.xyz',
  TRUST_PROXY: '1',
  TLS_TERMINATED_BY_PROXY: 'true',
  SESSION_COOKIE_SAME_SITE: 'lax',
  HACKCLUB_CLIENT_ID: 'id',
  HACKCLUB_CLIENT_SECRET: 'secret',
  HACKCLUB_REDIRECT_URI: 'https://guessit.akisarke.xyz/api/auth/hackclub/callback',
  AVATAR_UPLOAD_DIR: 'test-uploads/csp-check',
  LIMIT_LOGIN_IP: '5:60000',
  LIMIT_LOGIN_ACCOUNT: '5:60000',
  LIMIT_ANONYMOUS_IP: '5:60000',
  LIMIT_FORGOT_PASSWORD_IP: '5:60000',
  LIMIT_FORGOT_PASSWORD_ACCOUNT: '5:60000',
  LIMIT_RESET_PASSWORD_IP: '5:60000',
  LIMIT_RESET_PASSWORD_TOKEN_PREFIX: '5:60000',
  LIMIT_SIGNUP_IP: '5:60000',
  LIMIT_GENERATION_IP: '5:60000',
  LIMIT_GENERATION_USER: '5:60000',
  LIMIT_AVATAR_IP: '5:60000',
  LIMIT_AVATAR_USER: '5:60000',
  DUEL_MAX_PAYLOAD_BYTES: '65536',
  DUEL_COMMAND_LIMIT: '30',
  DUEL_COMMAND_WINDOW_MS: '60000',
});

describe('content security policy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      config,
      prisma: {} as never,
      logger: false,
      limiterStore: createDeterministicLimiterStore(),
      clientDistDir: 'test-uploads/no-client',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the Google Fonts stylesheet and font files', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain('style-src');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('font-src');
    expect(csp).toContain('https://fonts.gstatic.com');
  });

  it('allows the Hack Club member mark but stays same-origin elsewhere', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain('img-src');
    expect(csp).toContain('https://assets.hackclub.com');
    // Must not have been widened to a wildcard.
    expect(csp).not.toContain('img-src *');
    expect(csp).not.toContain('default-src *');
  });

  it('is enforced rather than report-only in production', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(String(response.headers['content-security-policy'])).toContain("default-src 'self'");
  });
});
