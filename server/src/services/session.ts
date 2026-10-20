import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { ServerConfig } from '../config.js';

export type SessionData = {
  userId: string;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

function sessionKey(config: ServerConfig): Buffer {
  return createHash('sha256').update(config.sessionSecret).digest();
}

export function encodeSession(data: SessionData, config: ServerConfig): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sessionKey(config), iv);
   const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decodeSession(value: string, nowMs: number, config: ServerConfig): SessionData | null {
  try {
    const [encodedIv, encodedTag, encodedPayload] = value.split('.');
    if (!encodedIv || !encodedTag || !encodedPayload) return null;
    const decipher = createDecipheriv('aes-256-gcm', sessionKey(config), Buffer.from(encodedIv, 'base64url'));
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    const payload = Buffer.concat([
      decipher.update(Buffer.from(encodedPayload, 'base64url')),
      decipher.final(),
    ]);
    const decoded: unknown = JSON.parse(payload.toString('utf8'));
    if (typeof decoded !== 'object' || decoded === null) return null;
    if (!('userId' in decoded) || !('sessionVersion' in decoded) || !('issuedAt' in decoded) || !('expiresAt' in decoded)) return null;
    if (typeof decoded.userId !== 'string' || decoded.userId.length === 0) return null;
    if (typeof decoded.sessionVersion !== 'number' || !Number.isInteger(decoded.sessionVersion) || decoded.sessionVersion < 0) return null;
    if (typeof decoded.issuedAt !== 'number' || !Number.isFinite(decoded.issuedAt) || decoded.issuedAt <= 0) return null;
    if (typeof decoded.expiresAt !== 'number' || !Number.isFinite(decoded.expiresAt) || decoded.expiresAt <= 0 || decoded.expiresAt <= decoded.issuedAt || decoded.expiresAt <= nowMs) return null;
    return { userId: decoded.userId, sessionVersion: decoded.sessionVersion, issuedAt: decoded.issuedAt, expiresAt: decoded.expiresAt };
  } catch {
    return null;
  }
}
