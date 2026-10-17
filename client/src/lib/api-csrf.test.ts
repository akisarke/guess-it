import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const jsonResponse = (body: unknown): Response => Response.json(body);

describe('API CSRF protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not acquire CSRF for GET requests', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ badges: [] }));

    await api.getBadges();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).not.toContain('/api/auth/csrf');
  });

  it('acquires a token with cookies and sends it on POST requests', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'test-token' }))
      .mockResolvedValueOnce(jsonResponse({ score: 1 }));

    await api.submitGuess({ source: { kind: 'daily', id: 'puzzle-1' }, questionId: 'q1', value: 42 });

    expect(fetcher.mock.calls[0]).toEqual([
      expect.stringContaining('/api/auth/csrf'),
      expect.objectContaining({ credentials: 'include' }),
    ]);
    expect(fetcher.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-csrf-token': 'test-token',
      }),
    }));
  });

  it('deduplicates concurrent token acquisitions', async () => {
    let resolveToken: ((response: Response) => void) | undefined;
    const tokenResponse = new Promise<Response>((resolve) => {
      resolveToken = resolve;
    });
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(tokenResponse)
      .mockImplementation(() => Promise.resolve(jsonResponse({ score: 1 })));

    const first = api.submitGuess({ source: { kind: 'daily', id: 'puzzle-1' }, questionId: 'q1', value: 42 });
    const second = api.submitGuess({ source: { kind: 'daily', id: 'puzzle-1' }, questionId: 'q2', value: 43 });
    resolveToken?.(jsonResponse({ csrfToken: 'shared-token' }));
    await Promise.all([first, second]);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.slice(1).every(([, options]) =>
      new Headers(options?.headers).get('x-csrf-token') === 'shared-token',
    )).toBe(true);
  });

  it.each([
    ['DELETE', () => api.unlinkHackClub()],
    ['PATCH', () => api.updateMyProfile({ bio: 'Updated' })],
  ])('sends the token on %s requests', async (_method, action) => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'mutation-token' }))
      .mockResolvedValueOnce(jsonResponse({ user: {} }));

    await action();

    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('x-csrf-token')).toBe('mutation-token');
  });

  it('does not set multipart content type for FormData', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'upload-token' }))
      .mockResolvedValueOnce(jsonResponse({ avatarUrl: '/avatar.png' }));

    await api.uploadAvatar(new File(['avatar'], 'avatar.png', { type: 'image/png' }));

    const options = fetcher.mock.calls[1]?.[1];
    expect(options?.body).toBeInstanceOf(FormData);
    expect(new Headers(options?.headers).get('content-type')).toBeNull();
    expect(new Headers(options?.headers).get('x-csrf-token')).toBe('upload-token');
  });
});
