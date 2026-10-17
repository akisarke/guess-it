import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { Prisma, PrismaClient, type Question, type User } from '@prisma/client';
import { vi } from 'vitest';
import { encodeSession } from '../services/session.js';
import { loadConfig } from '../config.js';

export const owner: User = {
   id: 'owner', displayName: 'Owner', authProvider: 'password', email: null,
  passwordHash: null, hackclubId: null, bio: null, avatarUrl: null,
   usernameChosen: true, isDeveloper: false, isOwner: false, sessionVersion: 0, failedLoginAttempts: 0, lockedUntil: null, emailVerifiedAt: new Date('2026-09-12'), createdAt: new Date('2026-09-12'),
};
export const questions: Question[] = ['q3', 'q1', 'q2'].map((id) => ({
  id, prompt: `Estimate ${id}`, unit: 'items', answer: new Prisma.Decimal(100),
  napkinMath: 'private explanation', sourceTitle: 'Guess It! test fixture', sourceUrl: 'https://guessit.game/', source: 'ai_generated', createdBy: owner.id,
  topic: 'scale', createdAt: new Date('2026-09-12'),
}));
export const puzzle = {
  id: 'daily-uuid', puzzleNumber: 42, puzzleDate: new Date('2026-09-12'),
  questionIds: ['q2', 'q3', 'q1'],
};
export const set = {
  id: 'set-1', ownerId: owner.id, title: 'Scale', topic: 'scale', difficulty: 'medium',
  source: 'ai_generated' as const, createdAt: new Date('2026-09-12'),
  questions: questions.map((question, position) => ({ setId: 'set-1', questionId: question.id, position, question })),
};
export const savedGuess = {
  id: 'guess-1', userId: owner.id, questionId: 'q3', value: new Prisma.Decimal(50),
  score: new Prisma.Decimal(2), createdAt: new Date('2026-09-12'),
};

export function gameplayDatabase() {
  const prisma = new PrismaClient();
  const reads = {
    set: vi.spyOn(prisma.questionSet, 'findUnique').mockResolvedValue(set),
    daily: vi.spyOn(prisma.dailyPuzzle, 'findUnique').mockResolvedValue(puzzle),
    questions: vi.spyOn(prisma.question, 'findMany').mockResolvedValue(questions),
    answer: vi.spyOn(prisma.question, 'findUnique').mockResolvedValue(questions[0]),
    guesses: vi.spyOn(prisma.guess, 'findMany').mockResolvedValue([savedGuess]),
  };
  vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(owner);
  vi.spyOn(prisma.dailyPuzzle, 'findFirst').mockResolvedValue(null);
  vi.spyOn(prisma.streak, 'findUnique').mockResolvedValue(null);
  const createGuess = vi.spyOn(prisma.guess, 'create').mockResolvedValue(savedGuess);
  vi.spyOn(prisma.guess, 'findUnique').mockResolvedValue(null);
  return { prisma, reads, createGuess };
}

export async function gameplayApp(prisma: PrismaClient) {
  const app = Fastify();
  app.decorate('prisma', prisma);
  await app.register(cookie, { secret: 'test-cookie-signing-key' });
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback' });
  app.decorate('config', config);
   const cookies = { [config.session.cookieName]: app.signCookie(encodeSession({ userId: owner.id, sessionVersion: owner.sessionVersion, issuedAt: Date.now(), expiresAt: Date.now() + config.session.maxAgeSeconds * 1_000 }, config)) };
  return { app, cookies };
}
