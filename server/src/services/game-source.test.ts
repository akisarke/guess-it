import { describe, expect, test } from 'vitest';
import { gameplayDatabase, set } from '../test/gameplay.js';
import { loadGameSource, GameSourceForbidden, GameSourceNotFound } from './game-source.js';

describe('loadGameSource', () => {
  test('orders daily questions by stored IDs and preserves the puzzle when loading its canonical ID', async () => {
    // Given
    const { prisma, reads } = gameplayDatabase();
    // When
    const result = await loadGameSource(prisma, { kind: 'daily', id: 'daily-uuid' }, 'viewer');
    // Then
    expect(result.questions.map((q) => q.id)).toEqual(['q2', 'q3', 'q1']);
    expect(result).toMatchObject({ source: { kind: 'daily', id: 'daily-uuid' }, puzzle: { id: 'daily-uuid', puzzleNumber: 42 } });
    expect(reads.daily).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'daily-uuid' } }));
    expect(reads.questions).toHaveBeenCalledWith({ where: { id: { in: ['q2', 'q3', 'q1'] } }, select: { id: true, prompt: true, unit: true } });
    expect(result.questions.every((q) => Object.keys(q).sort().join(',') === 'id,prompt,unit')).toBe(true);
  });

  test('returns only public questions in position order when the owner loads a generated set', async () => {
    // Given: deliberately return private fields too, to check output projection as well as selection.
    const { prisma, reads } = gameplayDatabase();
    // When
    const result = await loadGameSource(prisma, { kind: 'generated', id: set.id }, 'owner');
    // Then
    expect(result.questions.map((q) => q.id)).toEqual(['q3', 'q1', 'q2']);
    expect(result.questions.every((q) => Object.keys(q).sort().join(',') === 'id,prompt,unit')).toBe(true);
    expect(reads.set).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
      questions: { orderBy: { position: 'asc' }, select: { question: { select: { id: true, prompt: true, unit: true } } } },
    }) }));
    expect(reads.answer).not.toHaveBeenCalled();
  });

  test.each(['daily', 'generated'] as const)('scopes progress to the viewer when loading %s', async (kind) => {
    // Given
    const { prisma, reads } = gameplayDatabase();
    // When
    const result = await loadGameSource(prisma, { kind, id: kind === 'daily' ? 'daily-uuid' : set.id }, 'owner');
    // Then
    expect(result.userGuesses).toEqual({ q3: 2 });
    expect(reads.guesses).toHaveBeenCalledWith({
      where: { userId: 'owner', questionId: { in: result.questions.map((q) => q.id) } },
      select: { questionId: true, score: true },
    });
  });

  test('rejects a nonowner before reading guesses or answers', async () => {
    // Given
    const { prisma, reads } = gameplayDatabase();
    // When / Then
    await expect(loadGameSource(prisma, { kind: 'generated', id: set.id }, 'visitor')).rejects.toBeInstanceOf(GameSourceForbidden);
    expect(reads.guesses).not.toHaveBeenCalled();
    expect(reads.answer).not.toHaveBeenCalled();
  });

  test('returns fresh daily progress for a different viewer', async () => {
    // Given
    const { prisma, reads } = gameplayDatabase();
    reads.guesses.mockResolvedValue([]);
    // When
    const result = await loadGameSource(prisma, { kind: 'daily', id: 'daily-uuid' }, 'visitor');
    // Then
    expect(result.userGuesses).toEqual({});
    expect(reads.guesses).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'visitor', questionId: { in: ['q2', 'q3', 'q1'] } },
    }));
  });

  test.each(['daily', 'generated'] as const)('reports not found when the %s source is missing', async (kind) => {
    // Given
    const { prisma, reads } = gameplayDatabase();
    reads.set.mockResolvedValue(null);
    reads.daily.mockResolvedValue(null);
    // When / Then
    await expect(loadGameSource(prisma, { kind, id: 'missing' }, 'owner')).rejects.toBeInstanceOf(GameSourceNotFound);
  });
});
