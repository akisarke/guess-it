import { describe, expect, test } from 'vitest';
import { parsePruneConfig, pruneUsersKeeping } from './user-prune.js';

type Call = { model: string; op: string; where: unknown };

const KEEPER = 'keeper-id';
const OTHERS = ['anon-1', 'anon-2'];

function fakePrisma() {
  const calls: Call[] = [];
  const record = (model: string, op: string) => (args?: { where?: unknown }) => {
    calls.push({ model, op, where: args?.where });
    return Promise.resolve({ count: 0 });
  };
  const prisma = {
    user: {
      findUnique: ({ where }: { where: unknown }) => {
        calls.push({ model: 'user', op: 'findUnique', where });
        const name = (where as { displayName: string }).displayName;
        return Promise.resolve(name === 'akisarke' ? { id: KEEPER } : null);
      },
      findMany: ({ where }: { where: unknown }) => {
        calls.push({ model: 'user', op: 'findMany', where });
        return Promise.resolve(OTHERS.map((id) => ({ id, avatarUrl: null })));
      },
      deleteMany: record('user', 'deleteMany'),
    },
    guess: { deleteMany: record('guess', 'deleteMany') },
    streak: { deleteMany: record('streak', 'deleteMany') },
    userBadge: { deleteMany: record('userBadge', 'deleteMany'), updateMany: record('userBadge', 'updateMany') },
    matchmakingQueueEntry: { deleteMany: record('matchmakingQueueEntry', 'deleteMany') },
    duel: { deleteMany: record('duel', 'deleteMany') },
    question: { updateMany: record('question', 'updateMany') },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { prisma, calls };
}

describe('parsePruneConfig', () => {
  test('requires an explicit confirmation and a name to keep', () => {
    expect(() => parsePruneConfig({ PRUNE_USERS_CONFIRM: 'yes', PRUNE_KEEP_DISPLAY_NAME: 'akisarke' })).toThrow(/PRUNE_USERS_CONFIRM/);
    expect(() => parsePruneConfig({ PRUNE_USERS_CONFIRM: 'delete-all-but-keep-one' })).toThrow(/PRUNE_KEEP_DISPLAY_NAME/);
    expect(parsePruneConfig({ PRUNE_USERS_CONFIRM: 'delete-all-but-keep-one', PRUNE_KEEP_DISPLAY_NAME: ' akisarke ' })).toEqual({ keepDisplayName: 'akisarke' });
  });
});

describe('pruneUsersKeeping', () => {
  test('refuses to run when the keeper does not exist', async () => {
    const { prisma, calls } = fakePrisma();
    await expect(pruneUsersKeeping(prisma as never, { keepDisplayName: 'nobody' }, '/tmp')).rejects.toThrow(/Refusing to delete every account/);
    expect(calls.some((call) => call.op.endsWith('deleteMany'))).toBe(false);
  });

  test('scopes every delete to exclude the keeper', async () => {
    const { prisma, calls } = fakePrisma();
    const counts = await pruneUsersKeeping(prisma as never, { keepDisplayName: 'akisarke' }, '/tmp');

    expect(counts.keptUserId).toBe(KEEPER);

    const deletes = calls.filter((call) => call.op === 'deleteMany');
    expect(deletes.map((call) => call.model).sort()).toEqual([
      'duel',
      'guess',
      'matchmakingQueueEntry',
      'streak',
      'user',
      'userBadge',
    ]);

    // Every row-scoped delete must exclude the keeper, or we would delete their data.
    for (const call of deletes) {
      expect(JSON.stringify(call.where)).toContain(KEEPER);
    }

    const duel = calls.find((call) => call.model === 'duel' && call.op === 'deleteMany');
    expect(duel?.where).toEqual({ OR: [{ playerA: { not: KEEPER } }, { playerB: { not: KEEPER } }] });

    // Nullable foreign keys are cleared by the departing users, not wiped wholesale.
    const grantedBy = calls.find((call) => call.model === 'userBadge' && call.op === 'updateMany');
    expect(grantedBy?.where).toEqual({ grantedBy: { in: OTHERS } });
    const createdBy = calls.find((call) => call.model === 'question' && call.op === 'updateMany');
    expect(createdBy?.where).toEqual({ createdBy: { in: OTHERS } });
  });
});