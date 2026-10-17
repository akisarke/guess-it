import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, RateLimitError } from './application-error.js';
import { registerHttpErrorHandler } from './http-error-handler.js';

describe('registerHttpErrorHandler', () => {
  it('serializes application errors with status, code, and reset metadata', async () => {
    const app = Fastify({ logger: false });
    registerHttpErrorHandler(app);
    app.get('/missing', async () => {
      throw new NotFoundError('Missing resource');
    });
    app.get('/limited', async () => {
      throw new RateLimitError('Slow down', { resetAt: '2026-09-20T00:00:00.000Z', resetAtMs: 1_000 });
    });

    const missing = await app.inject({ method: 'GET', url: '/missing' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Missing resource', code: 'NOT_FOUND' });

    const limited = await app.inject({ method: 'GET', url: '/limited' });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      error: 'Slow down',
      code: 'RATE_LIMITED',
      resetAt: '2026-09-20T00:00:00.000Z',
      resetAtMs: 1_000,
    });
    await app.close();
  });

  it('normalizes schema validation errors without framework details', async () => {
    const app = Fastify({ logger: false });
    registerHttpErrorHandler(app);
    app.post('/validated', {
      schema: { body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } },
    }, async () => ({ ok: true }));

    const response = await app.inject({ method: 'POST', url: '/validated', payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Request validation failed', code: 'VALIDATION_ERROR' });
    await app.close();
  });

  it('normalizes invalid media types and redacts unknown failures', async () => {
    const app = Fastify({ logger: false });
    registerHttpErrorHandler(app);
    app.post('/media', async () => {
      const error = new Error('unsupported media type');
      error.name = 'FastifyError';
      Object.assign(error, { code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE' });
      throw error;
    });
    app.get('/unknown', async () => {
      throw new Error('database password: secret');
    });

    const media = await app.inject({ method: 'POST', url: '/media' });
    expect(media.statusCode).toBe(415);
    expect(media.json()).toEqual({ error: 'unsupported media type', code: 'VALIDATION_ERROR' });

    const unknown = await app.inject({ method: 'GET', url: '/unknown' });
    expect(unknown.statusCode).toBe(500);
    expect(unknown.json()).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(unknown.body).not.toContain('database password');
    await app.close();
  });

  it('does not expose arbitrary status-bearing errors', async () => {
    const app = Fastify({ logger: false });
    registerHttpErrorHandler(app);
    app.get('/status', async () => {
      const error = new Error('internal detail') as Error & { statusCode?: number };
      error.statusCode = 418;
      throw error;
    });

    const response = await app.inject({ method: 'GET', url: '/status' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    await app.close();
  });

  it('handles errors thrown inside registered route plugins', async () => {
    const app = Fastify({ logger: false });
    registerHttpErrorHandler(app);
    await app.register(async (plugin) => {
      plugin.get('/plugin-error', async () => {
        throw new ConflictError('Plugin conflict');
      });
    });

    const response = await app.inject({ method: 'GET', url: '/plugin-error' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'Plugin conflict', code: 'CONFLICT' });
    await app.close();
  });
});
