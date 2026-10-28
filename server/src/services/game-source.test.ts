import { describe, expect, test } from 'vitest';
import { gameplayDatabase, set } from '../test/gameplay.js';
import { loadGameSource, GameSourceForbidden, GameSourceNotFound } from './game-source.js';

describe('loadGameSource', () => {
  test('orders daily questions by stored IDs and preserves the puzzle when loading its canonical ID', async () => {

    const { prisma, reads } = gameplayDatabase();

    const result = await loadGameSource(prisma, { kind: 'daily', id: 'daily-uuid' }, 'viewer');

    expect(result.questions.map((q) => q.id)).toEqual(['q2', 'q3', 'q1']);
    expect(result).toMatchObject({ source: { kind: 'daily', id: 'daily-uuid' }, puzzle: { id: 'daily-uuid', puzzleNumber: 42 } });
    expect(reads.daily).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'daily-uuid' } }));
    expect(reads.questions).toHaveBeenCalledWith({ where: { id: { in: ['q2', 'q3', 'q1'] } }, select: { id: true, prompt: true, unit: true } });
    expect(result.questions.every((q) => Object.keys(q).sort().join(',') === 'id,prompt,unit')).toBe(true);
  });

  test('returns only public questions in position order when the owner loads a generated set', async () => {

    const { prisma, reads } = gameplayDatabase();

    const result = await loadGameSource(prisma, { kind: 'generated', id: set.id }, 'owner');

    expect(result.questions.map((q) => q.id)).toEqual(['q3', 'q1', 'q2']);
    expect(result.questions.every((q) => Object.keys(q).sort().join(',') === 'id,prompt,unit')).toBe(true);
    expect(reads.set).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
      questions: { orderBy: { position: 'asc' }, select: { question: { select: { id: true, prompt: true, unit: true } } } },
    }) }));
    expect(reads.answer).not.toHaveBeenCalled();
  });

  test.each(['daily', 'generated'] as const)('scopes progress to the viewer when loading %s', async (kind) => {

    const { prisma, reads } = gameplayDatabase();

    const result = await loadGameSource(prisma, { kind, id: kind === 'daily' ? 'daily-uuid' : set.id }, 'owner');

    expect(result.userGuesses).toEqual({ q3: 2 });
    expect(reads.guesses).toHaveBeenCalledWith({
      where: { userId: 'owner', questionId: { in: result.questions.map((q) => q.id) } },
      select: kind === 'daily' ? { questionId: true, score: true, mode: true } : { questionId: true, score: true },
    });
  });

  test('rejects a nonowner before reading guesses or answers', async () => {

    const { prisma, reads } = gameplayDatabase();

    await expect(loadGameSource(prisma, { kind: 'generated', id: set.id }, 'visitor')).rejects.toBeInstanceOf(GameSourceForbidden);
    expect(reads.guesses).not.toHaveBeenCalled();
    expect(reads.answer).not.toHaveBeenCalled();
  });

  test('returns fresh daily progress for a different viewer', async () => {

    const { prisma, reads } = gameplayDatabase();
    reads.guesses.mockResolvedValue([]);

    const result = await loadGameSource(prisma, { kind: 'daily', id: 'daily-uuid' }, 'visitor');

    expect(result.userGuesses).toEqual({});
    expect(reads.guesses).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'visitor', questionId: { in: ['q2', 'q3', 'q1'] } },
    }));
  });

  test.each(['daily', 'generated'] as const)('reports not found when the %s source is missing', async (kind) => {

    const { prisma, reads } = gameplayDatabase();
    reads.set.mockResolvedValue(null);
    reads.daily.mockResolvedValue(null);

    await expect(loadGameSource(prisma, { kind, id: 'missing' }, 'owner')).rejects.toBeInstanceOf(GameSourceNotFound);
  });
});
