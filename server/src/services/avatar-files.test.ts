import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, test } from 'vitest';
import sharp from 'sharp';
import { AvatarUploadError, storeAvatarFile } from './avatar-files.js';

async function upload(bytes: Buffer, root: string, limits?: Readonly<{ maxEncodedBytes: number; maxPixelsPerSide: number }>) {
  const file = Object.assign(Readable.from(bytes), { truncated: false, bytesRead: bytes.length });
  return storeAvatarFile(file, root, limits);
}

describe('avatar file boundary', () => {
  test('decodes input and stores canonical WebP', async () => {
    const root = await mkdtemp(join(tmpdir(), 'guessit-avatar-'));
    const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();

    const result = await upload(input, root);
    const files = await readdir(root);
    const metadata = await sharp(join(root, result.avatarUrl.split('/').at(-1) ?? '')).metadata();

    expect(result.mimeType).toBe('image/webp');
    expect(result.avatarUrl).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.webp$/);
    expect(files).toEqual([expect.stringMatching(/^[0-9a-f-]{36}\.webp$/)]);
    expect(metadata.format).toBe('webp');
  });

  test('rejects malformed image bytes and leaves no files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'guessit-avatar-'));

    await expect(upload(Buffer.from('not-an-image'), root)).rejects.toMatchObject({ statusCode: 415 });
    expect(await readdir(root)).toEqual([]);
  });

  test('rejects dimensions beyond the configured bound and cleans temporary files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'guessit-avatar-'));
    const input = await sharp({ create: { width: 3, height: 2, channels: 3, background: 'white' } }).png().toBuffer();

    await expect(upload(input, root, { maxEncodedBytes: 5 * 1024 * 1024, maxPixelsPerSide: 2 })).rejects.toBeInstanceOf(AvatarUploadError);
    expect(await readdir(root)).toEqual([]);
  });
});
