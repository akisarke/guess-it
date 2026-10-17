import { describe, expect, it, vi } from 'vitest';
import { PrismaClient, type User } from '@prisma/client';
import { buildApp } from '../app.js';
import { encodeSession } from '../services/session.js';
import { createDuelState } from '../services/duels/domain.js';
import { DuelCoordinator } from '../services/duels/coordinator.js';
import { parseDuelId, parsePlayerId } from 'shared';
import { loadConfig } from '../config.js';

const owner: User = {
  id: 'owner', displayName: 'Owner', authProvider: 'password', email: null, passwordHash: null,
  hackclubId: null, bio: null, avatarUrl: null, usernameChosen: true, isDeveloper: false,
  isOwner: false, sessionVersion: 0, failedLoginAttempts: 0, lockedUntil: null, emailVerifiedAt: new Date('2026-09-12'), createdAt: new Date('2026-09-12'),
};
const guest: User = { ...owner, id: 'guest', displayName: 'Guest' };

function waitForEvent(socket: { on(event: 'message', handler: (data: { toString(): string }) => void): void }, type: string): Promise<string> {
  return new Promise((resolve) => {
    socket.on('message', (data) => {
      const message = data.toString();
      if (message.includes(`"type":"${type}"`)) resolve(message);
    });
  });
}

describe('duel socket transport', () => {
  it('authenticates two clients and broadcasts hidden lock then reveal events', async () => {
    const prisma = new PrismaClient();
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(owner).mockResolvedValueOnce(guest);
    const coordinator = new DuelCoordinator({ now: () => new Date('2026-09-14T12:00:00Z') });
    coordinator.register(createDuelState({
      duelId: parseDuelId('duel-1'),
      players: [
        { playerId: parsePlayerId(owner.id), displayName: owner.displayName, avatarUrl: owner.avatarUrl },
        { playerId: parsePlayerId(guest.id), displayName: guest.displayName, avatarUrl: guest.avatarUrl },
      ],
      questions: [
        { id: 'q1', prompt: 'First', unit: 'items', answer: 100 },
        { id: 'q2', prompt: 'Second', unit: 'items', answer: 200 },
        { id: 'q3', prompt: 'Third', unit: 'items', answer: 300 },
      ],
      now: new Date('2026-09-14T12:00:00Z'),
    }));
    const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });
    const app = await buildApp({ config, prisma, duelCoordinator: coordinator });
    await app.ready();
  const ownerCookie = `${config.session.cookieName}=${app.signCookie(encodeSession({ userId: owner.id, sessionVersion: owner.sessionVersion, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config))}`;
  const guestCookie = `${config.session.cookieName}=${app.signCookie(encodeSession({ userId: guest.id, sessionVersion: guest.sessionVersion, issuedAt: 1, expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config))}`;
    const first = await app.injectWS('/api/duels/socket', { headers: { cookie: ownerCookie, origin: 'http://localhost:5173' } });
    const second = await app.injectWS('/api/duels/socket', { headers: { cookie: guestCookie, origin: 'http://localhost:5173' } });
    try {
      first.send(JSON.stringify({ type: 'duel.subscribe', duelId: 'duel-1' }));
      second.send(JSON.stringify({ type: 'duel.subscribe', duelId: 'duel-1' }));
      await waitForEvent(first, 'duel.snapshot');
      first.send(JSON.stringify({ type: 'duel.submit_answer', duelId: 'duel-1', roundIndex: 0, value: 90 }));
      const locked = await waitForEvent(second, 'duel.answer_locked');
      expect(locked).not.toContain('90');
      second.send(JSON.stringify({ type: 'duel.submit_answer', duelId: 'duel-1', roundIndex: 0, value: 110 }));
      const reveal = await waitForEvent(first, 'duel.round_reveal');
      expect(reveal).toContain('100');
    } finally {
      first.terminate();
      second.terminate();
      await app.close();
    }
  });
});
