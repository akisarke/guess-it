import { describe, expect, it } from 'vitest';
import type { ErrorCode, ErrorResponse } from './errors.js';

describe('ErrorResponse', () => {
  it('keeps legacy copy and rate-limit metadata beside a stable code', () => {
    const response: ErrorResponse = {
      error: 'Daily generation limit reached',
      code: 'GENERATION_QUOTA_EXCEEDED',
      resetAt: '2026-09-20T00:00:00.000Z',
      resetAtMs: 1_000,
    };

    expect(response).toEqual(expect.objectContaining({
      error: 'Daily generation limit reached',
      code: 'GENERATION_QUOTA_EXCEEDED',
    }));
  });

  it('accepts email verification as a stable error code', () => {
    const code: ErrorCode = 'EMAIL_VERIFICATION_REQUIRED';
    const response: ErrorResponse = {
      error: 'Email verification required',
      code,
    };

    expect(response).toEqual({
      error: 'Email verification required',
      code: 'EMAIL_VERIFICATION_REQUIRED',
    });
  });
});
