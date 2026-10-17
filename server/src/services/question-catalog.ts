import { z } from 'zod';

const catalogQuestionSchema = z.object({
  prompt: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  answer: z.number().finite().positive(),
  napkinMath: z.string().trim().min(1),
  sourceTitle: z.string().trim().min(1),
  sourceUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Source URL must use HTTPS.'),
}).strict();

export type CatalogQuestionInput = z.infer<typeof catalogQuestionSchema>;

export class CatalogQuestionError extends Error {
  readonly code = 'QUESTION_CATALOG_TOO_SMALL' as const;

  constructor() {
    super('The question catalog must contain at least three eligible questions.');
    this.name = 'CatalogQuestionError';
  }
}

type CatalogQuestionStore = {
  readonly question: {
    readonly findMany: (args: {
      readonly where: { readonly source: 'daily' };
      readonly orderBy: { readonly id: 'asc' };
      readonly select: { readonly id: true; readonly prompt: true };
    }) => Promise<readonly { readonly id: string; readonly prompt?: string }[]>;
  };
  readonly dailyPuzzle: {
    readonly findMany: (args: { readonly where?: { readonly puzzleDate: Date }; readonly select?: { readonly questionIds: true }; readonly orderBy?: { readonly puzzleDate: 'desc' } }) => Promise<readonly { readonly questionIds: readonly string[] }[]>;
  };
};

export function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function validateCatalogQuestion(input: unknown): CatalogQuestionInput {
  return catalogQuestionSchema.parse(input);
}

type EligibleCatalogQuestion = { id: string; prompt?: string | null };

/**
 * Catalog questions not yet consumed by any daily puzzle, de-duplicated by prompt.
 * A question is burned permanently once used, so this number only goes down unless
 * the catalog is topped up.
 */
async function loadEligibleCatalogQuestions(
  prisma: CatalogQuestionStore,
  now: Date,
): Promise<readonly EligibleCatalogQuestion[]> {
  const questions = await prisma.question.findMany({
    where: { source: 'daily' },
    orderBy: { id: 'asc' },
    select: { id: true, prompt: true },
  });
  // Fetch today's already-selected questionIds from the dailyPuzzle table.
  const todayPuzzles = await prisma.dailyPuzzle.findMany({ where: { puzzleDate: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) } });
  const todaySelectedIds = new Set(todayPuzzles.flatMap((p) => p.questionIds ?? []));
  const previousPuzzles = await prisma.dailyPuzzle.findMany({ select: { questionIds: true }, orderBy: { puzzleDate: 'desc' } });
  const usedQuestionIds = new Set(previousPuzzles.flatMap(({ questionIds }) => questionIds));
  const usedPromptKeys = new Set(
    questions
      .filter(({ id }) => usedQuestionIds.has(id))
      .map(({ prompt }) => prompt ? normalizePrompt(prompt) : null)
      .filter((prompt): prompt is string => prompt !== null),
  );

  const unusedQuestions = questions.filter(({ id, prompt }) => {
    const promptKey = prompt ? normalizePrompt(prompt) : null;
    return !usedQuestionIds.has(id) && (promptKey === null || !usedPromptKeys.has(promptKey)) && !todaySelectedIds.has(id);
  });

  return unusedQuestions.filter(({ prompt }, index, rows) => {
    if (!prompt) return true;
    const promptKey = normalizePrompt(prompt);
    return rows.findIndex((row) => row.prompt && normalizePrompt(row.prompt) === promptKey) === index;
  });
}

/** How many catalog questions remain eligible for future daily puzzles. */
export async function countEligibleCatalogQuestions(prisma: CatalogQuestionStore, now: Date): Promise<number> {
  return (await loadEligibleCatalogQuestions(prisma, now)).length;
}

export async function selectDailyCatalogQuestions(prisma: CatalogQuestionStore, now: Date): Promise<readonly [string, string, string]> {
  const uniqueQuestions = await loadEligibleCatalogQuestions(prisma, now);
  if (uniqueQuestions.length < 3) throw new CatalogQuestionError();

  const dayIndex = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const questionIds = uniqueQuestions.map(({ id }) => id).sort();
  const offset = (dayIndex * 3) % questionIds.length;
  const rotated = [...questionIds.slice(offset), ...questionIds.slice(0, offset)];
  const selected = rotated.slice(0, 3);
  const [first, second, third] = selected;
  if (!first || !second || !third) throw new CatalogQuestionError();
  return [first, second, third];
}
