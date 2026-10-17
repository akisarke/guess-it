import { z } from 'zod';
import { containsBlockedWord } from './word-blacklist.js';

const secureAvatarUrl = z.union([
  z.literal('').transform(() => null),
  z.string().trim().url().refine((value) => new URL(value).protocol === 'https:', 'Avatar URL must use HTTPS.'),
]);

const BLOCKED_MESSAGE = 'Remove the blocked word from your text.';

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Username must be at least 2 characters.').max(32, 'Username must be 32 characters or fewer.').regex(/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/, 'Use letters, numbers, underscores, or hyphens.').optional(),
  bio: z.string().trim().max(280, 'Bio must be 280 characters or fewer.').nullable().optional(),
  avatarUrl: secureAvatarUrl.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Include a bio or avatar URL to update.')
  .superRefine((value, ctx) => {
    if (value.displayName !== undefined && containsBlockedWord(value.displayName)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: BLOCKED_MESSAGE, path: ['displayName'] });
    }
    if (value.bio && containsBlockedWord(value.bio)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: BLOCKED_MESSAGE, path: ['bio'] });
    }
  });

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export type ProfileUpdateResult =
  | { readonly ok: true; readonly value: ProfileUpdate }
  | { readonly ok: false; readonly error: string };

export function parseProfileUpdate(input: unknown): ProfileUpdateResult {
  const result = profileUpdateSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid profile update.' };
  return { ok: true, value: result.data };
}
