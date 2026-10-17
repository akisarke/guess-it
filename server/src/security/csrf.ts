import { randomBytes, timingSafeEqual } from 'node:crypto';

export const csrfCookieName = 'guessit_csrf';
export const csrfHeaderName = 'x-csrf-token';
export const csrfFailure = { error: 'CSRF_VALIDATION_FAILED' } as const;

type CookieReply = { readonly setCookie: (name: string, value: string, options: Readonly<Record<string, unknown>>) => unknown };
type CsrfRequest = {
  readonly cookies: Readonly<Record<string, string | undefined>>;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly unsignCookie: (value: string) => { readonly valid: boolean; readonly value?: string | null };
};

export function issueCsrfToken(reply: CookieReply, options: { readonly secure: boolean }): string {
  const token = randomBytes(32).toString('base64url');
  reply.setCookie(csrfCookieName, token, {
    signed: true,
    httpOnly: false,
    secure: options.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return token;
}

export function verifyCsrfToken(request: CsrfRequest): boolean {
  const cookie = request.cookies[csrfCookieName];
  const header = request.headers[csrfHeaderName];
  if (!cookie || typeof header !== 'string' || header.length === 0) return false;
  const unsigned = request.unsignCookie(cookie);
  if (!unsigned.valid || !unsigned.value || unsigned.value.length !== header.length) return false;
  return timingSafeEqual(Buffer.from(unsigned.value), Buffer.from(header));
}
