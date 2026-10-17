import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createGeneratedSet,
  GeneratedSetQuotaError,
  getRemainingGenerations,
  listGeneratedSets,
} from './generated-sets.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  describe.skip('generated-set integration tests', () => {
    test('requires TEST_DATABASE_URL', () => undefined);
  });
} else {

const require = createRequire(import.meta.url);
const prismaCli = resolve(dirname(require.resolve('prisma/package.json')), 'build/index.js');

const schemaName = `generated_sets_${randomUUID().replaceAll('-', '')}`;
const schemaDatabaseUrl = new URL(testDatabaseUrl);
schemaDatabaseUrl.searchParams.set('schema', schemaName);
const adminPrisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
const prisma = new PrismaClient({ datasources: { db: { url: schemaDatabaseUrl.toString() } }, log: [{ emit: 'event', level: 'query' }] });
const now = new Date('2026-09-12T12:00:00.000Z');
const nextDay = new Date('2026-09-13T00:00:00.000Z');
let schemaCreated = false;
const queryEvents: string[] = [];

const questions = [
  { prompt: 'How many liters fit in a standard bathtub?', unit: 'LITERS', answer: 180, napkinMath: 'A bathtub holds about 180 liters.' },
  { prompt: 'How many pages are in a typical novel?', unit: 'PAGES', answer: 300, napkinMath: 'A typical novel has about 300 pages.' },
  { prompt: 'How many people live in a small town?', unit: 'PEOPLE', answer: 5000, napkinMath: 'A small town has about 5,000 people.' },
] as const;

prisma.$on('query', (event) => queryEvents.push(event.query));

async function createUser(): Promise<string> {
  const user = await prisma.user.create({ data: { displayName: `generated-${randomUUID()}`, authProvider: 'anonymous' } });
  return user.id;
}

async function createSet(ownerId: string, title = 'Everyday scale') {
  return createGeneratedSet(prisma, { ownerId, title, topic: 'everyday estimates', difficulty: 'medium', questions, now });
}

async function withRejectingAttemptTrigger(action: () => Promise<void>): Promise<void> {
  let functionCreated = false;
  let triggerCreated = false;
  try {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${schemaName}"."reject_generation_attempt"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'generation attempt rejected'; END; $$`);
    functionCreated = true;
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "reject_generation_attempt_trigger" BEFORE INSERT ON "${schemaName}"."GenerationAttempt" FOR EACH ROW EXECUTE FUNCTION "${schemaName}"."reject_generation_attempt"()`);
    triggerCreated = true;
    await action();
  } finally {
    try {
      if (triggerCreated) await prisma.$executeRawUnsafe(`DROP TRIGGER "reject_generation_attempt_trigger" ON "${schemaName}"."GenerationAttempt"`);
    } finally {
      if (functionCreated) await prisma.$executeRawUnsafe(`DROP FUNCTION "${schemaName}"."reject_generation_attempt"()`);
    }
  }
}

beforeAll(async () => {
  await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  schemaCreated = true;
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', 'src/prisma/schema.prisma'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: schemaDatabaseUrl.toString() },
    stdio: 'inherit',
  });
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
  if (schemaCreated) await adminPrisma.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
  await adminPrisma.$disconnect();
});

describe('generated-set persistence and quota', () => {
  test('stores exactly three ordered questions and returns the committed remaining quota', async () => {
    const ownerId = await createUser();
    const result = await createSet(ownerId);

    expect(result.remainingGenerations).toBe(2);
    expect(result.set.questions.map((question) => question.prompt)).toEqual(questions.map((question) => question.prompt));
    expect(result.set.questions.every((question) => !('answer' in question))).toBe(true);
    expect(await prisma.question.count({ where: { createdBy: ownerId } })).toBe(3);
    expect(await prisma.questionSetQuestion.count({ where: { setId: result.set.id } })).toBe(3);
    expect(await prisma.generationAttempt.count({ where: { userId: ownerId } })).toBe(1);
  });

  test('rejects the fourth successful UTC-day generation', async () => {
    const ownerId = await createUser();
    await createSet(ownerId, 'Set one');
    await createSet(ownerId, 'Set two');
    await createSet(ownerId, 'Set three');

    await expect(createSet(ownerId, 'Set four')).rejects.toBeInstanceOf(GeneratedSetQuotaError);
    expect(await getRemainingGenerations(prisma, ownerId, now)).toBe(0);
  });

  test('rolls back all generated rows when the attempt insert fails in PostgreSQL', async () => {
    const ownerId = await createUser();
    await withRejectingAttemptTrigger(async () => {
      await expect(createSet(ownerId, 'Rollback')).rejects.toThrow('generation attempt rejected');
    });

    expect(await prisma.questionSet.count({ where: { ownerId } })).toBe(0);
    expect(await prisma.questionSetQuestion.count({ where: { question: { createdBy: ownerId } } })).toBe(0);
    expect(await prisma.question.count({ where: { createdBy: ownerId } })).toBe(0);
    expect(await prisma.generationAttempt.count({ where: { userId: ownerId } })).toBe(0);
  });

  test('resets the quota at the next UTC day for a fresh owner', async () => {
    const ownerId = await createUser();
    await createSet(ownerId);

    expect(await getRemainingGenerations(prisma, ownerId, nextDay)).toBe(3);
  });

  test('computes completion independently for owner and viewer metadata', async () => {
    const ownerId = await createUser();
    const viewerId = await createUser();
    const result = await createSet(ownerId);
    const incompleteOwner = await listGeneratedSets(prisma, ownerId, ownerId);
    const incompleteViewer = await listGeneratedSets(prisma, viewerId, ownerId);

    expect(incompleteOwner[0]?.completed).toBe(false);
    expect(incompleteViewer[0]?.completed).toBe(false);
    for (const question of result.set.questions) {
      await prisma.guess.create({ data: { userId: ownerId, questionId: question.id, value: 1, score: 1 } });
    }

    const completeOwner = await listGeneratedSets(prisma, ownerId, ownerId);
    const stillIncompleteViewer = await listGeneratedSets(prisma, viewerId, ownerId);
    expect(completeOwner[0]?.completed).toBe(true);
    expect(stillIncompleteViewer[0]?.completed).toBe(false);
    expect(stillIncompleteViewer[0]).not.toHaveProperty('answer');
  });

  test('marks a viewer complete only after that viewer guesses all three questions', async () => {
    const ownerId = await createUser();
    const viewerId = await createUser();
    const result = await createSet(ownerId);
    for (const question of result.set.questions) {
      await prisma.guess.create({ data: { userId: viewerId, questionId: question.id, value: 1, score: 1 } });
    }

    const viewerSets = await listGeneratedSets(prisma, viewerId, ownerId);
    expect(viewerSets[0]?.completed).toBe(true);
  });

  test('allows exactly three concurrent successful creations for one owner', async () => {
    const ownerId = await createUser();
    const results = await Promise.allSettled([
      createSet(ownerId, 'Concurrent one'),
      createSet(ownerId, 'Concurrent two'),
      createSet(ownerId, 'Concurrent three'),
      createSet(ownerId, 'Concurrent four'),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(1);
    expect(rejected.every((result) => result.status === 'rejected' && result.reason instanceof GeneratedSetQuotaError)).toBe(true);
    expect(await prisma.questionSet.count({ where: { ownerId } })).toBe(3);
    expect(await prisma.generationAttempt.count({ where: { userId: ownerId } })).toBe(3);
    expect(await getRemainingGenerations(prisma, ownerId, now)).toBe(0);
  });

  test('acquires the database quota lock before counting attempts', async () => {
    const ownerId = await createUser();
    queryEvents.length = 0;
    await createSet(ownerId, 'Lock ordering');

    const lockIndex = queryEvents.findIndex((query) => query.includes('pg_advisory_xact_lock'));
    const countIndex = queryEvents.findIndex((query) => query.includes('COUNT') && query.includes('GenerationAttempt'));
    const isolationIndex = queryEvents.findIndex((query) => query.includes('READ COMMITTED'));
    expect(isolationIndex).toBeGreaterThanOrEqual(0);
    expect(isolationIndex).toBeLessThan(lockIndex);
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(countIndex).toBeGreaterThan(lockIndex);
  });
});

}
