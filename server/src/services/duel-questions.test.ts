import { describe, expect, it } from 'vitest';
import { selectDuelCatalogQuestions, CatalogQuestionError } from './question-catalog.js';

type CatalogStore = Parameters<typeof selectDuelCatalogQuestions>[0];

function store(ids: readonly string[]): CatalogStore {
  return {
    question: {
      findMany: async () => ids.map((id, index) => ({
        id,
        prompt: `Question ${index}`,
        unit: 'UNITS',
        answer: '1',
      })),
    },
    dailyPuzzle: { findMany: async () => [] },
  } as unknown as CatalogStore;
}

const now = new Date('2026-10-19T00:00:00.000Z');

describe('selectDuelCatalogQuestions', () => {
  it('is deterministic for the same duel id', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const first = await selectDuelCatalogQuestions(store(ids), now, 'duel-123');
    const second = await selectDuelCatalogQuestions(store(ids), now, 'duel-123');
    expect(first).toEqual(second);
  });

  it('gives different duels different question sets', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const first = await selectDuelCatalogQuestions(store(ids), now, 'duel-1');
    const second = await selectDuelCatalogQuestions(store(ids), now, 'duel-2');
    expect(first).not.toEqual(second);
  });

  it('never reuses a question from the excluded daily puzzle', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const daily = await selectDuelCatalogQuestions(store(ids), now, 'anything');
    const duel = await selectDuelCatalogQuestions(store(ids), now, 'duel-9', daily);
    expect(duel.some((id) => daily.includes(id))).toBe(false);
  });

  it('returns exactly three distinct ids', async () => {
    const duel = await selectDuelCatalogQuestions(store(['a', 'b', 'c', 'd', 'e', 'f']), now, 'duel-x');
    expect(duel).toHaveLength(3);
    expect(new Set(duel).size).toBe(3);
  });

  it('throws when the pool cannot supply three unused questions', async () => {
    await expect(selectDuelCatalogQuestions(store(['a', 'b']), now, 'duel-x')).rejects.toBeInstanceOf(CatalogQuestionError);

    await expect(selectDuelCatalogQuestions(store(['a', 'b', 'c']), now, 'duel-x', ['a', 'b', 'c'])).rejects.toBeInstanceOf(CatalogQuestionError);
  });
});
