import { describe, expect, it, vi } from 'vitest';
import { ensureCatalogDepth, CATALOG_TARGET_DEPTH } from './daily-generation.js';
import { loadConfig } from '../config.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/guessit',
  SESSION_SECRET: 'injected-session-secret-that-is-not-a-default-value',
  CLIENT_ORIGINS: 'https://test.example.test',
  APP_URL: 'https://test.example.test',
  TRUST_PROXY: 'loopback',
  HACKCLUB_CLIENT_ID: 'test-client',
  HACKCLUB_CLIENT_SECRET: 'test-client-secret',
  HACKCLUB_REDIRECT_URI: 'https://test.example.test/callback',
  AVATAR_UPLOAD_DIR: 'test-uploads/avatars',
});

const ai = vi.hoisted(() => ({ generateQuestion: vi.fn() }));
vi.mock('./ai.js', () => ({ generateQuestion: ai.generateQuestion }));

function makeStore(eligibleIds: readonly string[]) {
  const unused = new Set(eligibleIds);
  const question = {
    findMany: vi.fn(async (args: { where?: { source?: string } }) => {

      if (args.where?.source === 'daily') {
        return [...unused].map((id) => ({ id, prompt: `Prompt ${id}` }));
      }
      return [...unused].map((id) => ({ prompt: `Prompt ${id}` }));
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `new-${unused.size}`, ...data })),
  };
  const store = {
    question,
    dailyPuzzle: { findMany: vi.fn(async () => []) },
  };
  return { store: store as never, question };
}

describe('ensureCatalogDepth', () => {
  it('skips generation when the catalog already has enough depth', async () => {
    const { store } = makeStore(Array.from({ length: CATALOG_TARGET_DEPTH }, (_, i) => `q${i}`));
    const report = await ensureCatalogDepth(store, config);

    expect(report.skipped).toBe(true);
    expect(report.added).toBe(0);
    expect(ai.generateQuestion).not.toHaveBeenCalled();
  });

  it('tops the catalog up when depth has fallen below the target', async () => {
    ai.generateQuestion.mockReset();
    ai.generateQuestion.mockImplementation(async (topic: string) => ({
      prompt: `Unique prompt for ${topic}`,
      unit: 'UNITS',
      answer: 1234,
      napkinMath: 'x1',
    }));
    const { store: prisma, question } = makeStore(['q1', 'q2']);

    const report = await ensureCatalogDepth(prisma, config);

    expect(report.skipped).toBe(false);
    expect(report.eligibleBefore).toBe(2);
    expect(ai.generateQuestion).toHaveBeenCalled();
    expect(question.create).toHaveBeenCalled();

    const created = (question.create as unknown as { mock: { calls: [{ data: Record<string, unknown> }][] } }).mock.calls[0]?.[0].data;
    expect(created?.source).toBe('daily');
    expect(String(created?.sourceUrl)).toMatch(/^https:/);
  });

  it('reports failures instead of throwing when the provider is down', async () => {
    ai.generateQuestion.mockReset();
    ai.generateQuestion.mockRejectedValue(new Error('503 high demand'));
    const { store: prisma, question } = makeStore(['q1']);

    await expect(ensureCatalogDepth(prisma, config)).resolves.toMatchObject({ skipped: false });
    expect(question.create).not.toHaveBeenCalled();
  });

  it('never inserts a duplicate prompt it already generated this run', async () => {
    ai.generateQuestion.mockReset();
    ai.generateQuestion.mockResolvedValue({
      prompt: 'Exactly the same prompt',
      unit: 'UNITS',
      answer: 10,
      napkinMath: 'x1',
    });
    const { store: prisma } = makeStore(['q1']);

    const report = await ensureCatalogDepth(prisma, config);

    expect(report.added).toBe(1);
  });
});
