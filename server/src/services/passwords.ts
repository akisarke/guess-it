import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1 } as const;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return [
    'scrypt',
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, n, r, p, encodedSalt, encodedKey] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || n !== String(SCRYPT_OPTIONS.N) || r !== String(SCRYPT_OPTIONS.r)
    || p !== String(SCRYPT_OPTIONS.p) || !encodedSalt || !encodedKey) return false;

  const expectedKey = Buffer.from(encodedKey, 'base64url');
  if (expectedKey.length !== KEY_LENGTH) return false;
  const actualKey = await deriveKey(password, Buffer.from(encodedSalt, 'base64url'));
  return timingSafeEqual(actualKey, expectedKey);
}
