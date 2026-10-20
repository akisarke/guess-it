import { describe, expect, it } from 'vitest';
import { issueCsrfToken, verifyCsrfToken } from './csrf.js';

describe('signed double-submit CSRF', () => {
  it('accepts a matching signed cookie and header', () => {
    let cookie = '';
    const reply = { setCookie: (_name: string, value: string, _options: Record<string, unknown>) => { cookie = value; } };
    const token = issueCsrfToken(reply, { secure: false });
    const request = {
      cookies: { guessit_csrf: cookie },
      headers: { 'x-csrf-token': token },
      unsignCookie: (value: string) => ({ valid: value === cookie, value: token }),
    };
    expect(verifyCsrfToken(request)).toBe(true);
  });

  it('rejects missing and mismatched values', () => {
    const request = { cookies: {}, headers: {}, unsignCookie: () => ({ valid: false, value: null }) };
    expect(verifyCsrfToken(request)).toBe(false);
  });
});
