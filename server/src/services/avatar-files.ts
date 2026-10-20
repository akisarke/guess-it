import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import sharp from 'sharp';

import { ValidationError } from '../errors/application-error.js';

export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars/';
export const AVATAR_CANONICAL_MIME = 'image/webp' as const;
export const AVATAR_MAX_ENCODED_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_PIXELS_PER_SIDE = 4096;
export const MAX_AVATAR_BYTES = AVATAR_MAX_ENCODED_BYTES;

export type AvatarFormat = {
  extension: 'gif' | 'jpg' | 'png' | 'webp';
  mimeType: 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';
};

export type StoredAvatar = {
  avatarUrl: string;
  mimeType: typeof AVATAR_CANONICAL_MIME;
};

export class AvatarUploadError extends ValidationError {
  statusCode: 413 | 415;

  constructor(statusCode: 413 | 415, message: string) {
    super(message, { code: 'VALIDATION_ERROR' });
    this.name = 'AvatarUploadError';
    this.statusCode = statusCode;
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectAvatarFormat(bytes: Uint8Array): AvatarFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { extension: 'jpg', mimeType: 'image/jpeg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { extension: 'png', mimeType: 'image/png' };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return { extension: 'gif', mimeType: 'image/gif' };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) return { extension: 'webp', mimeType: 'image/webp' };
  return null;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function removeFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

export function localAvatarPath(avatarUrl: string | null, uploadDir: string): string | null {
  if (!avatarUrl?.startsWith(AVATAR_PUBLIC_PREFIX)) return null;
  const filename = avatarUrl.slice(AVATAR_PUBLIC_PREFIX.length);
  if (!/^[0-9a-f-]{36}\.(?:gif|jpg|png|webp)$/.test(filename)) return null;
  const root = resolve(uploadDir);
  const path = resolve(root, filename);
  return path.startsWith(`${root}\\`) || path.startsWith(`${root}/`) ? path : null;
}

export async function removeLocalAvatar(avatarUrl: string | null, uploadDir: string): Promise<void> {
  const path = localAvatarPath(avatarUrl, uploadDir);
  if (path) await removeFile(path);
}

export async function storeAvatarFile(file: MultipartFile['file'], uploadDir: string, limits: { maxEncodedBytes: number; maxPixelsPerSide: number } = { maxEncodedBytes: AVATAR_MAX_ENCODED_BYTES, maxPixelsPerSide: AVATAR_MAX_PIXELS_PER_SIDE }): Promise<StoredAvatar> {
  const root = resolve(uploadDir);
  await mkdir(root, { recursive: true });
  const id = randomUUID();
  const temporaryPath = resolve(root, `${id}.uploading`);
  const outputPath = resolve(root, `${id}.output.webp`);
  const finalPath = resolve(root, `${id}.webp`);

  try {
    await pipeline(file, createWriteStream(temporaryPath, { flags: 'wx' }));
    if (file.truncated) {
      throw new AvatarUploadError(413, 'Profile pictures must be 5 MB or smaller.');
    }
    const inputStats = await stat(temporaryPath);
    if (inputStats.size > limits.maxEncodedBytes) {
      throw new AvatarUploadError(413, 'Profile pictures must be 5 MB or smaller.');
    }
    const image = sharp(temporaryPath, { failOn: 'warning', limitInputPixels: limits.maxPixelsPerSide ** 2 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > limits.maxPixelsPerSide || metadata.height > limits.maxPixelsPerSide) {
      throw new AvatarUploadError(413, 'Profile picture dimensions are too large.');
    }
    await image.webp().toFile(outputPath);
    const outputStats = await stat(outputPath);
    if (outputStats.size > limits.maxEncodedBytes) {
      throw new AvatarUploadError(413, 'Profile picture output is too large.');
    }
    await rename(outputPath, finalPath);
    return { avatarUrl: `${AVATAR_PUBLIC_PREFIX}${id}.webp`, mimeType: AVATAR_CANONICAL_MIME };
  } catch (error) {
    await removeFile(temporaryPath);
    await removeFile(outputPath);
    await removeFile(finalPath);
    if (error instanceof Error && !(error instanceof AvatarUploadError)) {
      throw new AvatarUploadError(415, 'Use a valid JPEG, PNG, WebP, or GIF image.');
    }
    throw error;
  } finally {
    await removeFile(temporaryPath);
    await removeFile(outputPath);
  }
}
