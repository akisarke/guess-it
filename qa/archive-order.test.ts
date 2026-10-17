import { expect, test } from 'bun:test';

type ArchivePuzzleNumber = {
  readonly puzzleNumber: number;
};

type ArchivePayload = {
  readonly puzzles: readonly ArchivePuzzleNumber[];
};

function isArchivePayload(value: unknown): value is ArchivePayload {
  if (typeof value !== 'object' || value === null || !('puzzles' in value) || !Array.isArray(value.puzzles)) {
    return false;
  }

  return value.puzzles.every(
    (puzzle) =>
      typeof puzzle === 'object' &&
      puzzle !== null &&
      'puzzleNumber' in puzzle &&
      typeof puzzle.puzzleNumber === 'number',
  );
}

test('archive lists the first twelve puzzles in ascending numeric order', async () => {
  const response = await fetch('http://localhost:3001/api/puzzle/archive?limit=12');
  const payload: unknown = await response.json();

  expect(response.ok).toBe(true);
  expect(isArchivePayload(payload)).toBe(true);
  if (!isArchivePayload(payload)) return;

  expect(payload.puzzles.map((puzzle) => puzzle.puzzleNumber)).toEqual(
    Array.from({ length: 12 }, (_, index) => index),
  );
});
