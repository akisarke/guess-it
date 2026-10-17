import type { GeneratedGameSourceResponse, PuzzleResponse } from 'shared';

export const generated: GeneratedGameSourceResponse = {
  source: { kind: 'generated', id: 'set one' },
  set: { id: 'set one', title: 'Ocean estimates', topic: 'oceans', difficulty: 'medium', createdAt: '2026-09-12T00:00:00Z', completed: false },
  questions: [
    { id: 'q1', prompt: 'How many fish?', unit: 'fish' },
    { id: 'q2', prompt: 'How deep is the ocean?', unit: 'meters' },
    { id: 'q3', prompt: 'How many islands?', unit: 'islands' },
  ],
  userGuesses: {},
};

export const daily: PuzzleResponse = {
  source: { kind: 'daily', id: 'canonical-daily-uuid' },
  puzzle: { id: 'canonical-daily-uuid', puzzleNumber: 42, puzzleDate: '2026-09-12', questionIds: ['q1', 'q2', 'q3'] },
  questions: [...generated.questions], userGuesses: {},
};
