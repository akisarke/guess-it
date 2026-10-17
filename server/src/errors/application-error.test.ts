import { describe, expect, it } from 'vitest';
import type { ErrorCode } from 'shared';
import {
  ApplicationError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  ConfigurationError,
  InvariantError,
} from './application-error.js';

describe('ApplicationError hierarchy', () => {
  it('category constructors fix default status and code', () => {
    const cases: ReadonlyArray<{ name: string; error: ApplicationError; status: number; code: ErrorCode }> = [
      { name: 'ValidationError', error: new ValidationError('bad input'), status: 400, code: 'VALIDATION_ERROR' },
      { name: 'AuthenticationError', error: new AuthenticationError('no session'), status: 401, code: 'AUTHENTICATION_REQUIRED' },
      { name: 'AuthorizationError', error: new AuthorizationError('forbidden'), status: 403, code: 'FORBIDDEN' },
      { name: 'NotFoundError', error: new NotFoundError('missing'), status: 404, code: 'NOT_FOUND' },
      { name: 'ConflictError', error: new ConflictError('duplicate'), status: 409, code: 'CONFLICT' },
      { name: 'ExternalServiceError', error: new ExternalServiceError('upstream down'), status: 503, code: 'SERVICE_UNAVAILABLE' },
      { name: 'ConfigurationError', error: new ConfigurationError('bad config'), status: 500, code: 'CONFIGURATION_ERROR' },
      { name: 'InvariantError', error: new InvariantError('unreachable'), status: 500, code: 'INTERNAL_ERROR' },
    ];

    for (const c of cases) {
      expect(c.error.statusCode).toBe(c.status);
      expect(c.error.code).toBe(c.code);
      expect(c.error.message).toBe(c.name === 'ValidationError' ? 'bad input'
        : c.name === 'AuthenticationError' ? 'no session'
        : c.name === 'AuthorizationError' ? 'forbidden'
        : c.name === 'NotFoundError' ? 'missing'
        : c.name === 'ConflictError' ? 'duplicate'
        : c.name === 'ExternalServiceError' ? 'upstream down'
        : c.name === 'ConfigurationError' ? 'bad config'
        : 'unreachable');
      expect(c.error.name).toBe(c.name);
    }
  });

  it('preserves cause through ErrorOptions', () => {
    const cause = new Error('original');
    const error = new ValidationError('validation failed', { cause });
    expect(error.cause).toBe(cause);
  });

  it('allows an approved code override for category', () => {
    const error = new NotFoundError('not found', { code: 'INTERNAL_ERROR' });
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(404);
  });

  it('RateLimitError accepts GENERATION_QUOTA_EXCEEDED and reset metadata', () => {
    const error = new RateLimitError('Slow down', {
      code: 'GENERATION_QUOTA_EXCEEDED',
      resetAt: '2026-09-20T00:00:00.000Z',
      resetAtMs: 1_000,
    });
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('GENERATION_QUOTA_EXCEEDED');
    expect(error.resetAt).toBe('2026-09-20T00:00:00.000Z');
    expect(error.resetAtMs).toBe(1_000);
  });

  it('non-default status subclass keeps category code', () => {
    class PayloadTooLargeError extends ApplicationError {
      constructor(message: string) {
        super(413, 'VALIDATION_ERROR', message);
      }
    }
    const error = new PayloadTooLargeError('too big');
    expect(error.statusCode).toBe(413);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('PayloadTooLargeError');
  });

  it('base constructor is protected and sets concrete name', () => {
    class TestError extends ApplicationError {
      constructor(message: string) {
        super(400, 'VALIDATION_ERROR', message);
      }
    }
    const error = new TestError('test');
    expect(error.name).toBe('TestError');
  });
});
