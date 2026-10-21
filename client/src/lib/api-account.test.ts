import { describe, expect, it } from 'vitest';
import { ApiError, needsAccount } from './api';

describe('needsAccount', () => {
  it('counts a signed out request as a missing account', () => {
    expect(needsAccount(new ApiError(401, 'Not authenticated'))).toBe(true);
  });

  it('counts a forbidden request as a missing account', () => {
    expect(needsAccount(new ApiError(403, 'Create an account to use this feature.'))).toBe(true);
  });

  it('leaves an unverified email to its own message', () => {
    expect(needsAccount(new ApiError(403, 'Email verification is required.', undefined, 'EMAIL_VERIFICATION_REQUIRED'))).toBe(false);
  });

  it('ignores failures that are not about the account', () => {
    expect(needsAccount(new ApiError(500, 'Boom'))).toBe(false);
    expect(needsAccount(new Error('Boom'))).toBe(false);
  });
});
