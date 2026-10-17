import { expect, test } from 'bun:test';
import { parseProfileUpdate } from '../server/src/services/profile-input.js';
import { canManageOwnerTools } from '../server/src/services/owner.js';
import { getHackClubOAuthMode } from '../server/src/routes/hackclub-auth.js';
import { awardBadge, BadgeStore } from '../server/src/services/badges.js';
import { parseUsername } from '../server/src/services/username-input.js';
import { badgeIconForId } from '../client/src/lib/badge-icons.js';
import { parseMarkdownBlocks } from '../client/src/components/MarkdownBio.js';
import { MockPropertyContext } from 'node:test';
import { useLayoutEffect } from 'react';
import { toEntries } from '@neon/env';
import { validateCatalogQuestion } from '../server/src/services/question-catalog.js';
import { textField } from '../server/src/services/auth-helpers.js';

test('profile updates accept a trimmed bio and secure avatar URL', () => {
  const result = parseProfileUpdate({
    bio: '  Curious builder  ',
    avatarUrl: 'https://cdn.example.com/avatar.webp',
  });

  expect(result).toEqual({
    ok: true,
    value: { bio: 'Curious builder', avatarUrl: 'https://cdn.example.com/avatar.webp' },
  });
});

test('profile updates reject insecure or oversized avatar URLs', () => {
  expect(parseProfileUpdate({ avatarUrl: 'http://example.com/avatar.png' }).ok).toBe(false);
  expect(parseProfileUpdate({ bio: 'x'.repeat(281) }).ok).toBe(false);
});

test('only an owner can manage owner tools', () => {
  expect(canManageOwnerTools({ isOwner: true })).toBe(true);
  expect(canManageOwnerTools({ isOwner: false })).toBe(false);
});

test('Hack Club OAuth defaults to login and accepts link mode explicitly', () => {
  expect(getHackClubOAuthMode({})).toBe('login');
  expect(getHackClubOAuthMode({ mode: 'link' })).toBe('link');
  expect(getHackClubOAuthMode({ mode: 'unexpected' })).toBe('login');
});

test('badge assignment is idempotent and preserves the grant metadata', async () => {
  const created: Array<Record<string, string | undefined>> = [];
  const store = {
    userBadge: {
      findUnique: async ({ where }: { where: { userId_badgeId: { userId: string; badgeId: string } } }) =>
        created.find(
          (badge) => badge.userId === where.userId_badgeId.userId && badge.badgeId === where.userId_badgeId.badgeId,
        ) ?? null,
      create: async ({ data }: { data: Record<string, string | undefined> }) => {
        created.push(data);
        return data;
      },
    },
  } satisfies BadgeStore;

  const first = await awardBadge(store, 'user-1', 'ownerspick', 'owner-1', 'Featured profile');
  const second = await awardBadge(store, 'user-1', 'ownerspick', 'owner-1', 'Featured profile');

  expect(first).toBe(true);
  expect(second).toBe(false);
  expect(created).toEqual([
    { userId: 'user-1', badgeId: 'ownerspick', grantedBy: 'owner-1', note: 'Featured profile' },
  ]);
});

test('Hack Club linking accepts a normalized local username', () => {
  expect(parseUsername('  aleksa_23  ')).toEqual({ ok: true, value: 'aleksa_23' });
});

test('Hack Club linking rejects missing or name-like usernames', () => {
  expect(parseUsername(undefined)).toEqual({ ok: false, error: 'Choose a username.' });
  expect(parseUsername('Aleksa Saric').ok).toBe(false);
  expect(parseUsername('-aleks').ok).toBe(false);
});

test('profile updates parse a trimmed public display name', () => {
  expect(parseProfileUpdate({ displayName: '  akisarke  ' })).toEqual({
    ok: true,
    value: { displayName: 'akisarke' },
  });
});

test('MarkdownBio parses safe blocks and rejects unsafe links', () => {
  const blocks = parseMarkdownBlocks('**Bold**\n\n- One\n- Two\n\n[javascript](javascript:alert(1))');
  expect(blocks.some((block) => block.type === 'list')).toBe(true);
  expect(blocks.some((block) => block.type === 'paragraph' && block.content.some((part) => part.type === 'link' && part.href.startsWith('javascript:')))).toBe(false);
});

test('badge IDs map to deterministic icons with a fallback', () => {
  expect(badgeIconForId('streak7')).toBe(badgeIconForId('streak7'));
  expect(badgeIconForId('unknown')).toBe(badgeIconForId('another-unknown'));
});