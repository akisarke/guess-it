import { expect, test } from 'bun:test';
import { parseResetConfig } from '../server/src/services/user-reset.js';

test('reset refuses to run without the exact confirmation value', () => {
  expect(() => parseResetConfig({ OWNER_EMAIL: 'owner@example.com', OWNER_PASSWORD: 'secret', RESET_USERS_CONFIRM: 'delete-users' })).toThrow();
});

test('reset configuration requires owner credentials without exposing secrets', () => {
  expect(() => parseResetConfig({ RESET_USERS_CONFIRM: 'delete-all-users', OWNER_PASSWORD: 'super-secret' })).toThrow(/OWNER_EMAIL/);
  expect(() => parseResetConfig({ RESET_USERS_CONFIRM: 'delete-all-users', OWNER_EMAIL: 'owner@example.com' })).toThrow(/OWNER_PASSWORD/);
  try {
    parseResetConfig({ RESET_USERS_CONFIRM: 'delete-all-users', OWNER_EMAIL: 'owner@example.com' });
  } catch (error) {
    expect(error instanceof Error ? error.message : String(error)).not.toContain('super-secret');
  }
});
