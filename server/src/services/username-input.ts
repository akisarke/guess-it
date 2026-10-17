import { z } from 'zod';

const linkUsernameSchema = z
  .string()
  .trim()
  .min(2, 'Username must be at least 2 characters.')
  .max(32, 'Username must be 32 characters or fewer.')
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/, 'Use letters, numbers, underscores, or hyphens.');

export type UsernameResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

export function parseUsername(input: unknown): UsernameResult {
  if (typeof input !== 'string' || input.trim().length === 0) return { ok: false, error: 'Choose a username.' };
  const result = linkUsernameSchema.safeParse(input);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? 'Choose a username.' };
  return { ok: true, value: result.data };
}
