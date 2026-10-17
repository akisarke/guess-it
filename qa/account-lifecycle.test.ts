import { expect, test } from 'bun:test';
import { buildTemporaryHackClubDisplayName, canUnlinkHackClub } from '../server/src/routes/hackclub-auth.js';

test('new Hack Club users receive a temporary display name', () => {
  expect(buildTemporaryHackClubDisplayName('hc-user-123')).toBe('hackclub-094f96d1');
});

test('Hack Club unlink requires a password fallback', () => {
  expect(canUnlinkHackClub({ hackclubId: 'hc-1', email: 'user@example.com', passwordHash: 'hash' })).toBe(true);
  expect(canUnlinkHackClub({ hackclubId: 'hc-1', email: 'user@example.com', passwordHash: null })).toBe(false);
  expect(canUnlinkHackClub({ hackclubId: null, email: 'user@example.com', passwordHash: 'hash' })).toBe(false);
});
