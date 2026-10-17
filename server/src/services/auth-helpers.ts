import type { FastifyReply } from 'fastify';
import { encodeSession } from './session.js';
import type { ServerConfig } from '../config.js';

export function setSessionCookie(reply: FastifyReply, userId: string, sessionVersion: number, config: ServerConfig): void {
  const issuedAt = Date.now();
  reply.setCookie(config.session.cookieName, encodeSession({ userId, sessionVersion, issuedAt, expiresAt: issuedAt + config.session.maxAgeSeconds * 1_000 }, config), {
    signed: true,
    httpOnly: true,
    secure: config.session.secure,
    sameSite: config.session.sameSite,
    path: '/',
    maxAge: config.session.maxAgeSeconds,
  });
}

export function textField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null || !(field in value)) return undefined;
  const text: unknown = Reflect.get(value, field);
  return typeof text === 'string' && text.trim().length > 0 ? text : undefined;
}
