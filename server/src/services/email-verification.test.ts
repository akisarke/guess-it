import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { vi } from 'vitest';
import { ConfigurationError, ExternalServiceGatewayError, ValidationError } from '../errors/application-error.js';
import { createEmailVerificationToken, consumeEmailVerificationToken } from './email-verification.js';
import { sendEmailVerificationEmail } from './email.js';

const schemaPath = resolve(process.cwd(), 'src/prisma/schema.prisma');
const migrationPath = resolve(process.cwd(), 'src/prisma/migrations/20260920100000_add_email_verification/migration.sql');
const schema = readFileSync(schemaPath, 'utf8');
const migration = readFileSync(migrationPath, 'utf8');

describe('email verification persistence contract', () => {
  test('defines the exact verification fields and relations', () => {
    expect(schema).toContain('emailVerifiedAt     DateTime?');
    expect(schema).toContain('emailVerificationTokens EmailVerificationToken[]');
    expect(schema).toMatch(/model EmailVerificationToken \{[\s\S]*id\s+String\s+@id @default\(uuid\(\)\)[\s\S]*tokenHash\s+String\s+@unique[\s\S]*userId\s+String[\s\S]*expiresAt\s+DateTime[\s\S]*usedAt\s+DateTime\?[\s\S]*createdAt\s+DateTime @default\(now\(\)\)[\s\S]*user User @relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)[\s\S]*@@index\(\[userId, expiresAt\]\)[\s\S]*@@index\(\[expiresAt\]\)[\s\S]*\}/);
  }, 60_000);

  test('backfills existing users without credential or row deletion operations', () => {
    expect(migration).toContain('ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);');
    expect(migration).toContain('UPDATE "User"\nSET "emailVerifiedAt" = "createdAt"\nWHERE "emailVerifiedAt" IS NULL;');
    expect(migration).not.toMatch(/DELETE FROM|passwordHash|send\s+mail/i);
  });
});

const serviceNow = new Date('2026-09-20T12:00:00.000Z');

function makeServicePrisma(options: { token?: { id: string; userId: string } | null; consumeCount?: number } = {}) {
  const transaction = {
    emailVerificationToken: {
      findFirst: vi.fn().mockResolvedValue(options.token === undefined ? { id: 'token-1', userId: 'user-1' } : options.token),
      updateMany: vi.fn().mockResolvedValue({ count: options.consumeCount ?? 1 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
  return { transaction, $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<string>) => callback(transaction)) };
}

describe('email verification service', () => {
  test('creates a random raw token but persists only its hash for 30 minutes', async () => {
    const prisma = { emailVerificationToken: { create: vi.fn().mockResolvedValue({}) } };
    const rawToken = await createEmailVerificationToken(prisma, 'user-1', serviceNow);

    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({ data: {
      userId: 'user-1', tokenHash: expect.any(String), expiresAt: new Date('2026-09-20T12:30:00.000Z'),
    } });
    expect(JSON.stringify(prisma.emailVerificationToken.create.mock.calls[0]?.[0])).not.toContain(rawToken);
  });

  test('finds only unused, unexpired hashes and atomically verifies the user', async () => {
    const prisma = makeServicePrisma();
    await expect(consumeEmailVerificationToken(prisma as never, 'raw-token', serviceNow)).resolves.toBe('user-1');
    expect(prisma.transaction.emailVerificationToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usedAt: null, expiresAt: { gt: serviceNow }, tokenHash: expect.any(String) }) }));
    expect(prisma.transaction.emailVerificationToken.updateMany).toHaveBeenCalledWith({ where: { id: 'token-1', usedAt: null }, data: { usedAt: serviceNow } });
    expect(prisma.transaction.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { emailVerifiedAt: serviceNow, sessionVersion: { increment: 1 } } });
  });

  test('does not verify when missing, expired, used, or concurrently consumed', async () => {
    await expect(consumeEmailVerificationToken(makeServicePrisma({ token: null }) as never, 'token', serviceNow)).rejects.toThrow('invalid or expired');
    await expect(consumeEmailVerificationToken(makeServicePrisma({ consumeCount: 0 }) as never, 'token', serviceNow)).rejects.toThrow('invalid or expired');
  });

  test('rejects a second consumption after a successful consumption', async () => {
    let used = false;
    const prisma = {
      $transaction: vi.fn(async (callback: (transaction: unknown) => Promise<string>) => callback({
        emailVerificationToken: {
          findFirst: vi.fn(async () => used ? null : { id: 'token-1', userId: 'user-1' }),
          updateMany: vi.fn(async () => { if (used) return { count: 0 }; used = true; return { count: 1 }; }),
        },
        user: { update: vi.fn().mockResolvedValue({}) },
      })),
    };
    await expect(consumeEmailVerificationToken(prisma as never, 'token', serviceNow)).resolves.toBe('user-1');
    await expect(consumeEmailVerificationToken(prisma as never, 'token', serviceNow)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('verification email delivery', () => {
  const config = { appUrl: 'https://guess.it/app', email: { apiKey: 'secret', from: 'Guess It <noreply@guess.it>' } } as never;

  test('encodes the token in the configured URL and hides provider bodies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('provider-secret-body', { status: 400 }));
    const rawToken = 'raw token/&';
    const result = await sendEmailVerificationEmail('user@example.com', rawToken, config).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ExternalServiceGatewayError);
    expect(String(result)).not.toContain(rawToken);
    expect(JSON.stringify(result)).not.toContain(rawToken);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain(encodeURIComponent('raw token/&'));
    expect(String(request?.body)).not.toContain('provider-secret-body');
    fetchMock.mockRestore();
  });

  test('escapes dynamic URL content in email HTML without changing its URL value', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const escapedConfig = { appUrl: 'https://guess.it/?a=1&b="quoted"', email: { apiKey: 'secret', from: 'Guess It <noreply@guess.it>' } } as never;
    await sendEmailVerificationEmail('user@example.com', 'token', escapedConfig);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { html: string };
    expect(body.html).toContain('https://guess.it/?a=1&amp;b=&quot;quoted&quot;/verify-email?token=token');
    expect(body.html).not.toContain('href="https://guess.it/?a=1&b=');
    fetchMock.mockRestore();
  });

  test('maps missing email configuration to a typed configuration error', async () => {
    await expect(sendEmailVerificationEmail('user@example.com', 'token', { appUrl: 'https://guess.it', email: null } as never)).rejects.toBeInstanceOf(ConfigurationError);
  });
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const require = createRequire(import.meta.url);
const prismaCli = resolve(dirname(require.resolve('prisma/package.json')), 'build/index.js');
const schemaName = `email_verification_${randomUUID().replaceAll('-', '')}`;
const schemaDatabaseUrl = testDatabaseUrl ? new URL(testDatabaseUrl) : undefined;
schemaDatabaseUrl?.searchParams.set('schema', schemaName);
const adminPrisma = testDatabaseUrl ? new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } }) : undefined;
const prisma = schemaDatabaseUrl ? new PrismaClient({ datasources: { db: { url: schemaDatabaseUrl.toString() } } }) : undefined;
let schemaCreated = false;
let databaseAvailable = false;
let temporaryMigrationDirectory: string | undefined;

function isDatabaseUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /P1001|P1002|P1017|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Can't reach database server/i.test(message);
}

describe('email verification PostgreSQL persistence', () => {
  beforeAll(async () => {
    if (!adminPrisma || !prisma || !schemaDatabaseUrl) return;
    try {
      await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
      schemaCreated = true;
    } catch (error) {
      if (isDatabaseUnavailable(error)) return;
      throw error;
    }

    temporaryMigrationDirectory = mkdtempSync(join(tmpdir(), 'guessit-email-verification-'));
    const temporaryMigrations = join(temporaryMigrationDirectory, 'migrations');
    cpSync(resolve(process.cwd(), 'src/prisma/migrations'), temporaryMigrations, { recursive: true });
    rmSync(join(temporaryMigrations, '20260920100000_add_email_verification'), { recursive: true, force: true });
    rmSync(join(temporaryMigrations, '20260924120000_enable_email_verification_token_rls'), { recursive: true, force: true });
    const temporarySchema = join(temporaryMigrationDirectory, 'schema.prisma');
    writeFileSync(temporarySchema, readFileSync(resolve(process.cwd(), 'src/prisma/schema.prisma'), 'utf8'));
    try {
      execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', temporarySchema], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: schemaDatabaseUrl.toString() },
        stdio: 'inherit',
      });
      databaseAvailable = true;
    } catch (error) {
      if (isDatabaseUnavailable(error)) return;
      throw error;
    }
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (schemaCreated) await adminPrisma?.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
    await adminPrisma?.$disconnect();
    if (temporaryMigrationDirectory) rmSync(temporaryMigrationDirectory, { recursive: true, force: true });
  });

  test('enforces unique hashes, cascades token deletion, and backfills legacy users', async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
      return;
    }

    const userId = randomUUID();
    const displayName = `verification-${userId}`;
    const createdAt = new Date('2026-09-20T10:00:00.000Z');
    await prisma!.$executeRaw`INSERT INTO "User" ("id", "displayName", "authProvider", "createdAt") VALUES (${userId}, ${displayName}, 'anonymous', ${createdAt})`;

    for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
      await prisma!.$executeRawUnsafe(statement);
    }

    await prisma!.emailVerificationToken.create({ data: { tokenHash: `hash-${userId}`, userId, expiresAt: new Date('2026-09-21T00:00:00.000Z') } });
    await expect(prisma!.emailVerificationToken.create({ data: { tokenHash: `hash-${userId}`, userId, expiresAt: new Date('2026-09-22T00:00:00.000Z') } })).rejects.toThrow();

    const grandfathered = await prisma!.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true, passwordHash: true } });
    expect(grandfathered.emailVerifiedAt).toEqual(createdAt);
    expect(grandfathered.passwordHash).toBeNull();

    await prisma!.user.delete({ where: { id: userId } });
    expect(await prisma!.emailVerificationToken.count({ where: { userId } })).toBe(0);
  });

  test('allows exactly one concurrent consumption and rejects later reuse', async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
      return;
    }

    const userId = randomUUID();
    const displayName = `concurrent-verification-${userId}`;
    const now = new Date('2026-09-20T12:00:00.000Z');
    await prisma!.$executeRaw`INSERT INTO "User" ("id", "displayName", "authProvider", "createdAt", "sessionVersion") VALUES (${userId}, ${displayName}, 'anonymous', ${now}, 0)`;
    const rawToken = await createEmailVerificationToken(prisma!, userId, now);

    const results = await Promise.allSettled([
      consumeEmailVerificationToken(prisma!, rawToken, now),
      consumeEmailVerificationToken(prisma!, rawToken, now),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled' && result.value === userId)).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected' && result.reason instanceof ValidationError)).toHaveLength(1);

    const token = await prisma!.emailVerificationToken.findFirstOrThrow({ where: { userId } });
    const user = await prisma!.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true, sessionVersion: true } });
    expect(token.usedAt).toEqual(now);
    expect(user.emailVerifiedAt).toEqual(now);
    expect(user.sessionVersion).toBe(1);
    await expect(consumeEmailVerificationToken(prisma!, rawToken, now)).rejects.toBeInstanceOf(ValidationError);
    await prisma!.user.delete({ where: { id: userId } });
  });
});
