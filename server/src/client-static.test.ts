import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('client build serving', () => {
  let dist: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    dist = await mkdtemp(join(tmpdir(), 'guessit-client-'));
    await mkdir(join(dist, 'assets'), { recursive: true });
    await writeFile(join(dist, 'index.html'), '<!doctype html><title>Guess It!</title>');
    await writeFile(join(dist, 'assets', 'app.js'), 'export const x = 1;');
    app = await buildApp({
      config,
      prisma: {} as never,
      logger: false,
      limiterStore: createDeterministicLimiterStore(),
      clientDistDir: dist,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(dist, { recursive: true, force: true });
  });

  it('serves the client index at the site root', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain('Guess It!');
  });

  it('serves hashed build assets', async () => {
    const response = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain('export const x');
  });

  it('falls back to the client for unknown page routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/leaderboard' });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain('Guess It!');
  });

  it('keeps API 404s as JSON instead of serving the client shell', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.payload).not.toContain('<!doctype html>');
  });

  it('keeps avatar upload 404s as JSON', async () => {
    const response = await app.inject({ method: 'GET', url: '/uploads/avatars/missing.png' });
    expect(response.statusCode).toBe(404);
    expect(response.payload).not.toContain('<!doctype html>');
  });
});
