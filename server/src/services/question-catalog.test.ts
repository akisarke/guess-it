import { describe, expect, it, vi } from 'vitest';
import { CatalogQuestionError, selectDailyCatalogQuestions, validateCatalogQuestion } from './question-catalog.js';

const validQuestion = {
  prompt: 'How many bicycles are produced worldwide each year?',
  unit: 'BICYCLES',
  answer: 100_000_000,
  napkinMath: 'A global estimate.',
  sourceTitle: 'World Bicycle Industry Association report',
  sourceUrl: 'https://example.com/bicycles',
};

describe('question catalog', () => {
  it('parses an attributed catalog question', () => {
    expect(validateCatalogQuestion(validQuestion)).toEqual(validQuestion);
  });

  it('rejects empty content, invalid answers, and invalid source URLs', () => {
    expect(() => validateCatalogQuestion({ ...validQuestion, prompt: '' })).toThrow();
    expect(() => validateCatalogQuestion({ ...validQuestion, unit: ' ' })).toThrow();
    expect(() => validateCatalogQuestion({ ...validQuestion, napkinMath: '' })).toThrow();
    expect(() => validateCatalogQuestion({ ...validQuestion, answer: 0 })).toThrow();
    expect(() => validateCatalogQuestion({ ...validQuestion, answer: Number.NaN })).toThrow();
    expect(() => validateCatalogQuestion({ ...validQuestion, sourceUrl: 'not-a-url' })).toThrow();
  });

  it('requires three eligible catalog questions', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]);
    const prisma = { question: { findMany }, dailyPuzzle: { findMany: vi.fn().mockResolvedValue([]) } };

    await expect(selectDailyCatalogQuestions(prisma, new Date('2026-09-16T12:00:00Z')))
      .rejects.toBeInstanceOf(CatalogQuestionError);
  });

  it('selects the same three IDs for the same UTC day independent of query order', async () => {
    const rows = [{ id: 'q3' }, { id: 'q1' }, { id: 'q4' }, { id: 'q2' }];
    const findMany = vi.fn().mockResolvedValue(rows);
    const prisma = { question: { findMany }, dailyPuzzle: { findMany: vi.fn().mockResolvedValue([]) } };
    const first = await selectDailyCatalogQuestions(prisma, new Date('2026-09-16T00:01:00Z'));
    findMany.mockResolvedValue([...rows].reverse());
    const second = await selectDailyCatalogQuestions(prisma, new Date('2026-09-16T23:59:00Z'));

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { source: 'daily' } }));
  });

  it('does not share IDs between adjacent UTC days when the catalog has ten questions', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ id: `q${index + 1}` }));
    const prisma = { question: { findMany: vi.fn().mockResolvedValue(rows) }, dailyPuzzle: { findMany: vi.fn().mockResolvedValue([]) } };

    const firstDay = await selectDailyCatalogQuestions(prisma, new Date('2026-09-16T12:00:00Z'));
    const nextDay = await selectDailyCatalogQuestions(prisma, new Date('2026-09-17T12:00:00Z'));

    const sharedIds = firstDay.filter((id) => nextDay.includes(id));
    expect(sharedIds).toEqual([]);
  });

  it('excludes every question used by previous daily puzzles', async () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({ id: `q${index + 1}` }));
    const prisma = {
      question: { findMany: vi.fn().mockResolvedValue(rows) },
      dailyPuzzle: { findMany: vi.fn().mockResolvedValue([{ questionIds: ['q1', 'q2', 'q3'] }]) },
    };

    await expect(selectDailyCatalogQuestions(prisma, new Date('2026-09-18T12:00:00Z'))).resolves.toEqual(['q4', 'q5', 'q6']);
  });

  it('rejects an exhausted catalog instead of repeating questions', async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({ id: `q${index + 1}` }));
    const prisma = {
      question: { findMany: vi.fn().mockResolvedValue(rows) },
      dailyPuzzle: { findMany: vi.fn().mockResolvedValue([{ questionIds: ['q1', 'q2'] }]) },
    };

    await expect(selectDailyCatalogQuestions(prisma, new Date('2026-09-18T12:00:00Z')))
      .rejects.toBeInstanceOf(CatalogQuestionError);
  });

  it('does not select duplicate prompt content from separately stored catalog rows', async () => {
    const rows = [
      { id: 'q1', prompt: 'How many books are published worldwide each year?' },
      { id: 'q2', prompt: 'How many books are published worldwide each year?' },
      { id: 'q3', prompt: 'How many bicycles are produced worldwide each year?' },
      { id: 'q4', prompt: 'How many cups of coffee are consumed worldwide each day?' },
      { id: 'q5', prompt: 'How many airplanes are in the air at any given moment?' },
    ];
    const prisma = {
      question: { findMany: vi.fn().mockResolvedValue(rows) },
      dailyPuzzle: { findMany: vi.fn().mockResolvedValue([{ questionIds: ['q1'] }]) },
    };

    const selected = await selectDailyCatalogQuestions(prisma, new Date('2026-09-18T12:00:00Z'));

    expect(selected).not.toContain('q2');
    expect(selected).toHaveLength(3);
  });
});
