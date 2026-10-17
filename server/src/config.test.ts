import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validProductionEnvironment: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://db.example.test:5432/guessit',
  SESSION_SECRET: 'a'.repeat(64),
  SESSION_COOKIE_SAME_SITE: 'lax',
  CLIENT_ORIGINS: 'https://guessit.example.test,https://www.example.test',
  APP_URL: 'https://guessit.example.test',
  TRUST_PROXY: '10.0.0.0/8',
  HACKCLUB_CLIENT_ID: 'client-id',
  HACKCLUB_CLIENT_SECRET: 'b'.repeat(48),
  HACKCLUB_REDIRECT_URI: 'https://guessit.example.test/api/auth/hackclub/callback',
  RESEND_API_KEY: 'resend-test-key',
  EMAIL_FROM: 'Guess It <noreply@example.test>',
  GEMINI_API_KEY: 'gemini-test-key',
  GEMINI_MODEL: 'gemini-2.5-flash',
  LIMIT_LOGIN_IP: '5:60000', LIMIT_LOGIN_ACCOUNT: '5:60000', LIMIT_ANONYMOUS_IP: '5:60000',
  LIMIT_FORGOT_PASSWORD_IP: '5:60000', LIMIT_FORGOT_PASSWORD_ACCOUNT: '5:60000', LIMIT_RESET_PASSWORD_IP: '5:60000',
  LIMIT_RESET_PASSWORD_TOKEN_PREFIX: '5:60000', LIMIT_SIGNUP_IP: '5:60000', LIMIT_GENERATION_IP: '5:60000', LIMIT_GENERATION_USER: '5:60000',
  LIMIT_AVATAR_IP: '5:60000', LIMIT_AVATAR_USER: '5:60000',
  DUEL_MAX_PAYLOAD_BYTES: '16384', DUEL_COMMAND_LIMIT: '20', DUEL_COMMAND_WINDOW_MS: '10000',
};

const expectConfigError = (action: () => unknown, field: string, forbiddenValues: readonly string[] = []): void => {
  let message = '';
  try {
    action();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    message = error.message;
  }
  expect(message).toBe(`Invalid configuration field: ${field}`);
  for (const forbiddenValue of forbiddenValues) expect(message).not.toContain(forbiddenValue);
};

describe('loadConfig', () => {
  it('rejects production when the session secret is missing', () => {
    const environment = { ...validProductionEnvironment };
    delete environment.SESSION_SECRET;

    expectConfigError(() => loadConfig(environment), 'SESSION_SECRET');
  });

  it('requires a safe explicit production session cookie policy', () => {
    const missing = { ...validProductionEnvironment };
    delete missing.SESSION_COOKIE_SAME_SITE;
    expectConfigError(() => loadConfig(missing), 'SESSION_COOKIE_SAME_SITE');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, SESSION_COOKIE_SAME_SITE: 'none' }), 'SESSION_COOKIE_SAME_SITE');
    expect(loadConfig(validProductionEnvironment).session).toMatchObject({ sameSite: 'lax', secure: true });
  });

  it('rejects production when a limiter policy is missing or malformed', () => {
    const missing = { ...validProductionEnvironment };
    delete missing.LIMIT_LOGIN_IP;
    expectConfigError(() => loadConfig(missing), 'LIMIT_LOGIN_IP');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, LIMIT_LOGIN_IP: '0:60000' }), 'LIMIT_LOGIN_IP');
  });

  it('rejects wildcard or path-bearing production origins', () => {
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, CLIENT_ORIGINS: '*' }), 'CLIENT_ORIGINS', ['*']);
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, CLIENT_ORIGINS: 'https://example.test/path' }), 'CLIENT_ORIGINS', ['https://example.test/path']);
  });

  it('rejects production localhost and incomplete OAuth configuration', () => {
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, CLIENT_ORIGINS: 'http://localhost:5173' }), 'CLIENT_ORIGINS', ['http://localhost:5173']);
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, HACKCLUB_CLIENT_SECRET: '' }), 'HACKCLUB_CLIENT_SECRET');
  });

  it('rejects short secrets and malformed URLs', () => {
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, SESSION_SECRET: 'short' }), 'SESSION_SECRET', ['short']);
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, DATABASE_URL: 'not-a-url' }), 'DATABASE_URL', ['not-a-url']);
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, APP_URL: 'not-a-url' }), 'APP_URL', ['not-a-url']);
  });

  it('allows documented defaults only in development', () => {
    const config = loadConfig({ NODE_ENV: 'development' });

expect(config.clientOrigins).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
    expect(config.appUrl).toBe('http://localhost:5173');
    expect(config.port).toBe(3001);
    expect(config.duelSecurity).toEqual({ maxPayloadBytes: 16 * 1024, commandLimit: 20, commandWindowMs: 10_000 });
  });

  it('requires explicit Duel security limits in production', () => {
    const environment = { ...validProductionEnvironment };
    delete environment.DUEL_MAX_PAYLOAD_BYTES;
    expectConfigError(() => loadConfig(environment), 'DUEL_MAX_PAYLOAD_BYTES');
  });

  it('accepts explicit test configuration without reading process environment', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test.example.test:5432/guessit',
      TEST_DATABASE_URL: 'postgresql://test.example.test:5432/guessit_test',
      SESSION_SECRET: 'c'.repeat(64),
      CLIENT_ORIGINS: 'http://localhost:5173,https://test.example.test',
      APP_URL: 'https://test.example.test',
      TRUST_PROXY: 'loopback',
      HACKCLUB_CLIENT_ID: 'test-client',
      HACKCLUB_CLIENT_SECRET: 'd'.repeat(48),
      HACKCLUB_REDIRECT_URI: 'https://test.example.test/api/auth/hackclub/callback',
    });

    expect(config.sessionSecret).toBe('c'.repeat(64));
    expect(config.clientOrigins).toEqual(['http://localhost:5173', 'https://test.example.test']);
  });

  it('ignores normal process environment extras', () => {
    const config = loadConfig({ ...validProductionEnvironment, PATH: 'ambient-path', HOME: 'ambient-home', npm_config_user_agent: 'ambient-npm' });

    expect(config.environment).toBe('production');
  });

  it('rejects omitted or invalid environment mode', () => {
    const omitted = { ...validProductionEnvironment };
    delete omitted.NODE_ENV;
    expectConfigError(() => loadConfig(omitted), 'NODE_ENV');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, NODE_ENV: 'staging' }), 'NODE_ENV');
  });

  it('deduplicates origins and rejects empty entries', () => {
    const config = loadConfig({ ...validProductionEnvironment, CLIENT_ORIGINS: 'https://guessit.example.test/, https://guessit.example.test' });

    expect(config.clientOrigins).toEqual(['https://guessit.example.test']);
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, CLIENT_ORIGINS: 'https://guessit.example.test, ' }), 'CLIENT_ORIGINS');
  });

  it('rejects production HTTP origins and invalid bounds', () => {
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, CLIENT_ORIGINS: 'http://guessit.example.test' }), 'CLIENT_ORIGINS');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, PORT: '0' }), 'PORT');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, DAILY_GEN_HOUR_UTC: '24' }), 'DAILY_GEN_HOUR_UTC');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, DAILY_GEN_MINUTE_UTC: '60' }), 'DAILY_GEN_MINUTE_UTC');
  });

  it('enforces field-specific URL protocols', () => {
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, DATABASE_URL: 'https://db.example.test/guessit' }), 'DATABASE_URL');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, APP_URL: 'ftp://guessit.example.test' }), 'APP_URL');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, HACKCLUB_REDIRECT_URI: 'ftp://guessit.example.test/callback' }), 'HACKCLUB_REDIRECT_URI');
    expectConfigError(() => loadConfig({ ...validProductionEnvironment, TEST_DATABASE_URL: 'https://db.example.test/test' }), 'TEST_DATABASE_URL');
  });

  it('represents optional provider groups as null', () => {
    const environment = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test.example.test:5432/guessit',
      SESSION_SECRET: 'c'.repeat(64),
      CLIENT_ORIGINS: 'https://test.example.test',
      APP_URL: 'https://test.example.test',
      TRUST_PROXY: 'loopback',
      HACKCLUB_CLIENT_ID: 'test-client',
      HACKCLUB_CLIENT_SECRET: 'd'.repeat(48),
      HACKCLUB_REDIRECT_URI: 'https://test.example.test/api/auth/hackclub/callback',
    };

    const config = loadConfig(environment);

    expect(config.email).toBeNull();
    expect(config.gemini).toBeNull();
  });
});
