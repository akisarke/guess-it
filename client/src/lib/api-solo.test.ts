import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { generated } from '../test/solo-fixtures';

describe('solo API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads an encoded generated play path with credentials', async () => {
    // Given an answer-free public response.
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(generated));
    // When loading a saved set.
    const result = await api.getQuestionSetPlay('set one');
    // Then the dedicated endpoint preserves the public payload.
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/question-sets/set%20one/play'), expect.objectContaining({ credentials: 'include' }));
    expect(result).toEqual(generated);
    expect(result.questions[0]).not.toHaveProperty('answer');
  });

  it.each([401, 403, 404, 500])('preserves HTTP %i on generated summary failures', async (status) => {
    // Given a failed summary response.
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unavailable' }, { status }));
    // When requesting the summary, then the existing error contract survives.
    const code = status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : undefined;
    await expect(api.getQuestionSetSummary('set one')).rejects.toEqual(new ApiError(status, 'Unavailable', undefined, code));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/set%20one/summary'), expect.anything());
  });

  it('parses typed error metadata without changing the message', async () => {
    // Given a typed server error response.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      error: 'Quota copy',
      code: 'GENERATION_QUOTA_EXCEEDED',
      resetAt: 'tomorrow',
      resetAtMs: 1234,
    }, { status: 429 }));

    // When requesting a failed summary.
    const failure = api.getQuestionSetSummary('set one');

    // Then the shared code and reset metadata reach ApiError.
    await expect(failure).rejects.toEqual(new ApiError(429, 'Quota copy', 'tomorrow', 'GENERATION_QUOTA_EXCEEDED', 1234));
  });

  it('keeps legacy errors safe when code is absent', async () => {
    // Given a legacy error body.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Legacy copy' }, { status: 400 }));

    // When requesting a failed summary.
    const failure = api.getQuestionSetSummary('set one');

    // Then the message and status remain available without typed metadata.
    await expect(failure).rejects.toEqual(new ApiError(400, 'Legacy copy', undefined, 'VALIDATION_ERROR'));
  });

  it.each([
    ['malformed JSON', { json: () => Promise.reject(new SyntaxError('bad json')) }, 'Request failed'],
    ['non-object JSON', { json: () => Promise.resolve(['not an error']) }, 'HTTP 500'],
    ['missing error', { json: () => Promise.resolve({ code: 'INTERNAL_ERROR' }) }, 'HTTP 500'],
  ])('uses safe fallback for %s', async (_label, response, message) => {
    // Given a failed response whose body cannot provide an error message.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    vi.spyOn(Response.prototype, 'json').mockImplementation(response.json);

    // When requesting a failed summary.
    const failure = api.getQuestionSetSummary('set one');

    // Then the documented fallback message is preserved.
    const code = _label === 'missing error' ? 'INTERNAL_ERROR' : undefined;
    await expect(failure).rejects.toEqual(new ApiError(500, message, undefined, code));
  });

  it('serializes source along with the estimate', async () => {
    // Given a successful guess endpoint.
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      return Promise.resolve(url.includes('/api/auth/csrf')
        ? Response.json({ csrfToken: 'solo-token' })
        : Response.json({ score: 2, answer: 100, direction: 'Too Low', scoreBand: 'medium' }));
    });
    const input = { source: generated.source, questionId: 'q1', value: 50 };
    // When submitting a generated estimate.
    await api.submitGuess(input);
    // Then the server receives the source-aware contract.
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/guess'), expect.objectContaining({ body: JSON.stringify(input), method: 'POST' }));
  });

  it('navigates to a token-free verification redirect', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'http://localhost:5173', assign } });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: 'http://localhost:5173/verify-email?verified=1' },
    }));

    await api.verifyEmail('secret-token');

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/auth/verify-email?token=secret-token'), expect.objectContaining({ credentials: 'include', redirect: 'manual' }));
    expect(assign).toHaveBeenCalledWith('http://localhost:5173/verify-email?verified=1');
  });

  it('parses invalid verification responses as typed errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'That verification link is invalid or expired.', code: 'VALIDATION_ERROR' }, { status: 400 }));

    await expect(api.verifyEmail('secret-token')).rejects.toEqual(new ApiError(400, 'That verification link is invalid or expired.', undefined, 'VALIDATION_ERROR'));
  });

  it.each([
    ['external origin', 'https://evil.example/verify-email?verified=1'],
    ['token query', '/verify-email?verified=1&token=secret-token'],
    ['fragment', '/verify-email?verified=1#secret-token'],
    ['malformed URL', 'http://[malformed'],
  ])('rejects unsafe or malformed verification redirect: %s', async (_label, location) => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: 'http://localhost:5173', assign } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 302, headers: { Location: location } }));

    await expect(api.verifyEmail('secret-token')).rejects.toEqual(new ApiError(302, 'Request failed'));
    expect(assign).not.toHaveBeenCalled();
  });
});
