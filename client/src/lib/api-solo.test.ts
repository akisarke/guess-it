import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { generated } from '../test/solo-fixtures';

describe('solo API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads an encoded generated play path with credentials', async () => {

    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(generated));

    const result = await api.getQuestionSetPlay('set one');

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/question-sets/set%20one/play'), expect.objectContaining({ credentials: 'include' }));
    expect(result).toEqual(generated);
    expect(result.questions[0]).not.toHaveProperty('answer');
  });

  it.each([401, 403, 404, 500])('turns HTTP %i into friendly copy on generated summary failures', async (status) => {

    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Unavailable' }, { status }));

    const code = status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : undefined;
    const message = {
      401: 'Sign in to keep going.',
      403: "You don't have access to that.",
      404: "We couldn't find that. It may have moved or been deleted.",
      500: 'Something went wrong on our side. Try again in a moment.',
    }[status];
    await expect(api.getQuestionSetSummary('set one')).rejects.toEqual(new ApiError(status, message!, undefined, code));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/set%20one/summary'), expect.anything());
  });

  it('parses typed error metadata and swaps in player-facing copy', async () => {

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      error: 'Quota copy',
      code: 'GENERATION_QUOTA_EXCEEDED',
      resetAt: 'tomorrow',
      resetAtMs: 1234,
    }, { status: 429 }));

    const failure = api.getQuestionSetSummary('set one');

    await expect(failure).rejects.toEqual(new ApiError(429, "You've used today's question generations. More unlock tomorrow.", 'tomorrow', 'GENERATION_QUOTA_EXCEEDED', 1234));
  });

  it('keeps legacy errors safe when code is absent', async () => {

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Legacy copy' }, { status: 400 }));

    const failure = api.getQuestionSetSummary('set one');

    await expect(failure).rejects.toEqual(new ApiError(400, 'Legacy copy', undefined, 'VALIDATION_ERROR'));
  });

  it.each([
    ['malformed JSON', { json: () => Promise.reject(new SyntaxError('bad json')) }, 'Something went wrong on our side. Try again in a moment.'],
    ['non-object JSON', { json: () => Promise.resolve(['not an error']) }, 'Something went wrong on our side. Try again in a moment.'],
    ['missing error', { json: () => Promise.resolve({ code: 'INTERNAL_ERROR' }) }, 'Something went wrong on our side. Try again in a moment.'],
  ])('uses safe fallback for %s', async (_label, response, message) => {

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    vi.spyOn(Response.prototype, 'json').mockImplementation(response.json);

    const failure = api.getQuestionSetSummary('set one');

    const code = _label === 'missing error' ? 'INTERNAL_ERROR' : undefined;
    await expect(failure).rejects.toEqual(new ApiError(500, message, undefined, code));
  });

  it('serializes source along with the estimate', async () => {

    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      return Promise.resolve(url.includes('/api/auth/csrf')
        ? Response.json({ csrfToken: 'solo-token' })
        : Response.json({ score: 2, answer: 100, direction: 'Too Low', scoreBand: 'medium' }));
    });
    const input = { source: generated.source, questionId: 'q1', value: 50 };

    await api.submitGuess(input);

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

    await expect(api.verifyEmail('secret-token')).rejects.toEqual(new ApiError(302, 'Something went wrong on our side. Try again in a moment.'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows a connection message instead of the browser error when the network is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.getQuestionSetSummary('set one')).rejects.toEqual(
      new ApiError(0, "Can't reach Guess It! right now. Check your connection and try again.", undefined, 'SERVICE_UNAVAILABLE'),
    );
  });

  it('hides the generic schema-validation text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'Request validation failed', code: 'VALIDATION_ERROR' }, { status: 400 }));

    await expect(api.getQuestionSetSummary('set one')).rejects.toEqual(
      new ApiError(400, "Something in that doesn't look right. Check it and try again.", undefined, 'VALIDATION_ERROR'),
    );
  });
});
