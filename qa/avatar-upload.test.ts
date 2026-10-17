import { expect, test } from 'bun:test';
import { detectAvatarFormat, localAvatarPath, MAX_AVATAR_BYTES } from '../server/src/services/avatar-files.js';

const API_URL = 'http://localhost:3001';
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function createAuthenticatedCookie(): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/anonymous`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: `avatar-qa-${crypto.randomUUID()}` }),
  });
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Anonymous login did not return a session cookie.');
  const separator = setCookie.indexOf(';');
  return separator === -1 ? setCookie : setCookie.slice(0, separator);
}

function isAvatarResponse(value: unknown): value is { avatarUrl: string } {
  return typeof value === 'object' && value !== null && 'avatarUrl' in value && typeof value.avatarUrl === 'string';
}

function isProfileResponse(value: unknown): value is { user: { avatarUrl: string } } {
  return typeof value === 'object' && value !== null && 'user' in value && isAvatarResponse(value.user);
}

async function uploadAvatar(cookie: string, image = ONE_PIXEL_PNG, filename = 'avatar.png'): Promise<Response> {
  const form = new FormData();
  form.set('avatar', new Blob([image], { type: 'application/octet-stream' }), filename);
  return fetch(`${API_URL}/api/users/me/avatar`, { method: 'POST', headers: { cookie }, body: form });
}

test('avatar upload requires authentication', async () => {
  const form = new FormData();
  form.set('avatar', new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'avatar.png');

  const response = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'POST',
    body: form,
  });

  expect(response.status).toBe(401);
});

test('avatar upload rejects content whose signature is not an allowed raster image', async () => {
  const cookie = await createAuthenticatedCookie();
  const form = new FormData();
  form.set('avatar', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/png' }), 'avatar.png');

  const response = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });

  expect(response.status).toBe(415);
});

test('avatar upload requires the avatar multipart field', async () => {
  const cookie = await createAuthenticatedCookie();
  const form = new FormData();
  form.set('image', new Blob([ONE_PIXEL_PNG]), 'avatar.png');

  const response = await fetch(`${API_URL}/api/users/me/avatar`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });

  expect(response.status).toBe(400);
});

test('avatar signatures map to safe server-controlled extensions', () => {
  expect(detectAvatarFormat(Uint8Array.from([0xff, 0xd8, 0xff]))).toEqual({ extension: 'jpg', mimeType: 'image/jpeg' });
  expect(detectAvatarFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ extension: 'png', mimeType: 'image/png' });
  expect(detectAvatarFormat(Buffer.from('GIF89a'))).toEqual({ extension: 'gif', mimeType: 'image/gif' });
  expect(detectAvatarFormat(Buffer.from('RIFF0000WEBP'))).toEqual({ extension: 'webp', mimeType: 'image/webp' });
});

test('local avatar cleanup rejects external and traversal paths', () => {
  expect(localAvatarPath('https://cdn.example/avatar.png')).toBeNull();
  expect(localAvatarPath('/uploads/avatars/../../secret.png')).toBeNull();
  expect(localAvatarPath('/uploads/avatars/00000000-0000-4000-8000-000000000000.png')).not.toBeNull();
});

test('avatar upload rejects files larger than 50 MiB', async () => {
  const cookie = await createAuthenticatedCookie();
  const oversizedImage = new Uint8Array(MAX_AVATAR_BYTES + 1);
  oversizedImage.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const response = await uploadAvatar(cookie, oversizedImage, 'oversized.png');

  expect(response.status).toBe(413);
});

test('avatar upload accepts an authenticated PNG image', async () => {
  const cookie = await createAuthenticatedCookie();
  const response = await uploadAvatar(cookie);

  expect(response.status).toBe(200);
  const payload: unknown = await response.json();
  expect(isAvatarResponse(payload)).toBe(true);
  if (!isAvatarResponse(payload)) throw new Error('Avatar response did not include an avatarUrl.');
  expect(payload.avatarUrl).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.png$/);

  const storedImage = await fetch(`${API_URL}${payload.avatarUrl}`);
  expect(storedImage.status).toBe(200);
  expect(storedImage.headers.get('content-type')).toBe('image/png');
  expect(Buffer.from(await storedImage.arrayBuffer())).toEqual(ONE_PIXEL_PNG);

  const profile = await fetch(`${API_URL}/api/users/me/profile`, { headers: { cookie } });
  const profilePayload: unknown = await profile.json();
  expect(isProfileResponse(profilePayload)).toBe(true);
  if (!isProfileResponse(profilePayload)) throw new Error('Profile response did not include an avatarUrl.');
  expect(profilePayload.user.avatarUrl).toBe(payload.avatarUrl);
});

test('replacing an avatar removes the previous local file', async () => {
  const cookie = await createAuthenticatedCookie();
  const firstResponse = await uploadAvatar(cookie);
  const firstPayload: unknown = await firstResponse.json();
  if (!isAvatarResponse(firstPayload)) throw new Error('First upload did not include an avatarUrl.');

  const secondResponse = await uploadAvatar(cookie);
  const secondPayload: unknown = await secondResponse.json();
  if (!isAvatarResponse(secondPayload)) throw new Error('Second upload did not include an avatarUrl.');

  expect(secondPayload.avatarUrl).not.toBe(firstPayload.avatarUrl);
  expect((await fetch(`${API_URL}${firstPayload.avatarUrl}`)).status).toBe(404);
  expect((await fetch(`${API_URL}${secondPayload.avatarUrl}`)).status).toBe(200);
});
