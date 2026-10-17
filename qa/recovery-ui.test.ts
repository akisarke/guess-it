import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const forgotPassword = readFileSync(new URL('../client/src/pages/ForgotPassword.tsx', import.meta.url), 'utf8');
const resetPassword = readFileSync(new URL('../client/src/pages/ResetPassword.tsx', import.meta.url), 'utf8');

test('forgot password exposes a labeled email field and pending submit state', () => {
  expect(forgotPassword).toContain('htmlFor="recovery-email"');
  expect(forgotPassword).toContain('autoComplete="email"');
  expect(forgotPassword).toContain('Sending');
});

test('reset password exposes labeled fields and accessible visibility controls', () => {
  expect(resetPassword).toContain('htmlFor="new-password"');
  expect(resetPassword).toContain('htmlFor="confirm-password"');
  expect(resetPassword).toContain('Show password');
});
