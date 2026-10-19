import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { generateQuestion } from './ai.js';
import { getTodayPuzzle, utcDayRange } from './daily-puzzle.js';
import { DAILY_TOPICS } from './daily-topics.js';
import { normalizePrompt, countEligibleCatalogQuestions, validateCatalogQuestion } from './question-catalog.js';
import type { ServerConfig } from '../config.js';

export const DAILY_QUESTION_COUNT = 3;
const MAX_ATTEMPTS_PER_TOPIC = 3;
const MIN_ANSWER = 0.01;
const MAX_ANSWER = 1e15;

export const CATALOG_TARGET_DEPTH = 45;
const CATALOG_TOPUP_BATCH = DAILY_QUESTION_COUNT;

export type RejectedGeneration = {
  readonly topic: string;
  readonly attempt: number;
  readonly reason: string;
  readonly detail?: string;
};

export type DailyGenerationReport = {
  readonly date: string;
  readonly questionIds: readonly string[];
  readonly topics: readonly string[];
  readonly source: 'ai_daily' | 'daily-fallback';
  readonly rejected: readonly RejectedGeneration[];
};

type GeneratedDraft = {
  readonly prompt: string;
  readonly unit: string;
  readonly answer: number;
  readonly napkinMath: string;
};

const BLOCKED_SUBSTRINGS: readonly string[] = [
  'damn',
  'hell',
  'shit',
  'fuck',
  'bitch',
  'bastard',
  'asshole',
  'dick',
  'pussy',
  'slut',
  'whore',
  'cunt',
  'nigger',
  'faggot',
  'retard',
  'kys',
  'kill yourself',
] as const;

function validateDraft(draft: GeneratedDraft): string | null {
  if (typeof draft.prompt !== 'string' || draft.prompt.trim().length < 10 || draft.prompt.length > 300) {
    return 'prompt-length';
  }
  if (!draft.prompt.trim().endsWith('?')) {
    return 'prompt-not-question';
  }
  if (!/^[A-Za-z][A-Za-z0-9 ]{0,23}$/.test(draft.unit.trim())) {
    return 'unit-format';
  }
  if (!Number.isFinite(draft.answer) || draft.answer < MIN_ANSWER || draft.answer > MAX_ANSWER) {
    return 'answer-bounds';
  }
  if (typeof draft.napkinMath !== 'string' || draft.napkinMath.trim().length < 20) {
    return 'napkin-too-short';
  }
  return null;
}

function contentCheck(prompt: string): string | null {
  const lowered = prompt.toLowerCase();
  if (/(https?:\/\/|www\.)/.test(lowered)) return 'prompt-contains-url';
  const hit = BLOCKED_SUBSTRINGS.find((word) => lowered.includes(word));
  return hit ? `prompt-blocked-word:${hit}` : null;
}

function sanityCheckNapkinMath(draft: GeneratedDraft): string | null {
  const numbers = draft.napkinMath.match(/-?\d[\d,]*(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
  if (!numbers) return 'napkin-no-numbers';
  const withinBounds = numbers.some((raw) => {
    const value = Number(raw.replace(/,/g, ''));
    return Number.isFinite(value) && value >= draft.answer / 1000 && value <= draft.answer * 1000;
  });
  return withinBounds ? null : 'napkin-magnitude-mismatch';
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function pickDailyTopics(
  prisma: PrismaClient,
  date: Date,
  count = DAILY_QUESTION_COUNT,
  repeatWindowDays: number,
): Promise<string[]> {
  const windowDays = repeatWindowDays;
  const windowStart = new Date(date);
  windowStart.setUTCHours(0, 0, 0, 0);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  const recent = await prisma.dailyPuzzle.findMany({
    where: { puzzleDate: { gte: windowStart } },
    select: { questionIds: true },
  });
  const recentIds = [...new Set(recent.flatMap((p) => p.questionIds))];
  const recentQuestions =
    recentIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: recentIds }, topic: { not: null } },
          select: { topic: true },
        })
      : [];
  const used = new Set(recentQuestions.map((q) => q.topic as string));
  const daySeed = Math.floor(utcDayRange(date).gte.getTime() / 86_400_000);
  const fresh = seededShuffle(DAILY_TOPICS.filter((t) => !used.has(t)), daySeed);
  const topics = fresh.slice(0, count);
  if (topics.length < count) {
    const fallback = seededShuffle(DAILY_TOPICS, daySeed + 1).filter((t) => !topics.includes(t));
    topics.push(...fallback.slice(0, count - topics.length));
  }
  return topics;
}

async function generateTopicWithRetry(
  topic: string,
  rejected: RejectedGeneration[],
  config: ServerConfig,
  excludedPrompts: ReadonlySet<string>,
): Promise<GeneratedDraft | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_TOPIC; attempt++) {
    let draft: GeneratedDraft;
    try {
      draft = await generateQuestion(topic, 'medium', config, undefined, [...excludedPrompts]);
    } catch (error) {
      rejected.push({
        topic,
        attempt,
        reason: 'generation-error',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const failure = excludedPrompts.has(normalizePrompt(draft.prompt))
      ? 'prompt-duplicate'
      : validateDraft(draft) ?? contentCheck(draft.prompt) ?? sanityCheckNapkinMath(draft);
    if (!failure) return draft;
    rejected.push({ topic, attempt, reason: failure, detail: draft.prompt.slice(0, 160) });
  }
  return null;
}

export async function ensureDailyPuzzleForDate(
  prisma: PrismaClient,
  date: Date,
  config: ServerConfig,
): Promise<DailyGenerationReport> {
  const day = utcDayRange(date);

  const rejected: RejectedGeneration[] = [];
  const topics = await pickDailyTopics(prisma, date, DAILY_QUESTION_COUNT, config.dailyGeneration.repeatWindowDays);
  const previousDailyQuestions = await prisma.question.findMany({
    where: { source: { in: ['daily', 'ai_daily'] } },
    select: { prompt: true },
  });
  const excludedPrompts = new Set(previousDailyQuestions.map(({ prompt }) => normalizePrompt(prompt)));
  const drafts: GeneratedDraft[] = [];
  for (const topic of topics) {
    const draft = await generateTopicWithRetry(topic, rejected, config, excludedPrompts);
    if (!draft) break;
    drafts.push(draft);
    excludedPrompts.add(normalizePrompt(draft.prompt));
  }

  if (drafts.length === DAILY_QUESTION_COUNT) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const found = await prisma.dailyPuzzle.findFirst({ where: { puzzleDate: day } });
      if (found) {
        return { date: day.gte.toISOString(), questionIds: found.questionIds, topics: [], source: 'ai_daily', rejected };
      }
      try {
        const created = await prisma.$transaction(async (tx) => {
          const latest = await tx.dailyPuzzle.findFirst({ orderBy: { puzzleNumber: 'desc' } });
          const questionIds: string[] = [];
          for (let i = 0; i < drafts.length; i++) {
            const created_ = await tx.question.create({
              data: {
                prompt: drafts[i].prompt,
                unit: drafts[i].unit,
                answer: drafts[i].answer,
                napkinMath: drafts[i].napkinMath,
                sourceTitle: 'Guess It! generated daily question',
                sourceUrl: 'https://guessit.game/',
                source: 'ai_daily',
                topic: topics[i],
              },
            });
            questionIds.push(created_.id);
          }
          return tx.dailyPuzzle.create({
            data: {
              puzzleNumber: (latest?.puzzleNumber ?? 0) + 1,
              puzzleDate: day.gte,
              questionIds,
            },
          });
        });
        if (rejected.length > 0) {
          console.warn(JSON.stringify({ event: 'daily-generation-rejected', date: day.gte.toISOString(), rejected }));
        }
        return {
          date: day.gte.toISOString(),
          questionIds: created.questionIds,
          topics,
          source: 'ai_daily',
          rejected,
        };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        if (attempt === 2) throw error;
      }
    }
  }

  console.warn(
    JSON.stringify({ event: 'daily-generation-fallback', date: day.gte.toISOString(), topics, rejected }),
  );
  const fallback = await getTodayPuzzle(prisma, date);
  return {
    date: day.gte.toISOString(),
    questionIds: fallback?.questionIds ?? [],
    topics: [],
    source: 'daily-fallback',
    rejected,
  };
}

export type CatalogTopUpReport = {
  readonly eligibleBefore: number;
  readonly eligibleAfter: number;
  readonly added: number;
  readonly skipped: boolean;
  readonly failed: number;
};

export async function ensureCatalogDepth(
  prisma: PrismaClient,
  config: ServerConfig,
  now = new Date(),
  log?: { info: (msg: string) => void; warn: (msg: string) => void },
): Promise<CatalogTopUpReport> {
  const eligibleBefore = await countEligibleCatalogQuestions(prisma as never, now);
  if (eligibleBefore >= CATALOG_TARGET_DEPTH) {
    return { eligibleBefore, eligibleAfter: eligibleBefore, added: 0, skipped: true, failed: 0 };
  }

  const needed = CATALOG_TARGET_DEPTH - eligibleBefore;
  const existingPrompts = await prisma.question.findMany({ where: { source: 'daily' }, select: { prompt: true } });
  const seen = new Set(existingPrompts.map(({ prompt }) => prompt ? normalizePrompt(prompt) : null));

  let added = 0;
  let failed = 0;
  const candidates = seededShuffle(DAILY_TOPICS, Math.floor(now.getTime() / 86_400_000));
  for (const topic of candidates) {
    if (added >= needed) break;
    try {
      const draft = await generateQuestion(topic, 'medium', config);
      const key = normalizePrompt(draft.prompt);
      if (seen.has(key)) continue;

      const valid = validateCatalogQuestion({
        prompt: draft.prompt,
        unit: draft.unit,
        answer: draft.answer,
        napkinMath: draft.napkinMath,
        sourceTitle: 'Guess It! generated question',
        sourceUrl: 'https://guessit.game/',
      });
      await prisma.question.create({ data: { ...valid, source: 'daily', topic } });
      seen.add(key);
      added += 1;
    } catch {
      failed += 1;
    }
  }

  const eligibleAfter = await countEligibleCatalogQuestions(prisma as never, now);
  log?.warn(
    JSON.stringify({ event: 'catalog-topup', eligibleBefore, eligibleAfter, added, failed, target: CATALOG_TARGET_DEPTH }),
  );
  return { eligibleBefore, eligibleAfter, added, skipped: false, failed };
}

export function msUntilNextDailyRun(now: Date, hourUtc: number, minuteUtc: number): number {  const next = new Date(now);
  next.setUTCHours(hourUtc, minuteUtc, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function scheduleDailyGeneration(
  prisma: PrismaClient,
  config: ServerConfig,
  log?: { info: (msg: string) => void; error: (obj: unknown, msg: string) => void },
) {
  const tick = () => {
    const { hourUtc, minuteUtc } = config.dailyGeneration;
    const delay = msUntilNextDailyRun(new Date(), hourUtc, minuteUtc);
    const timer = setTimeout(async () => {
      try {
        const report = await ensureDailyPuzzleForDate(prisma, new Date(), config);
        log?.info(`Daily generation complete: ${report.source} (${report.questionIds.length} questions)`);
      } catch (error) {
        log?.error(error, 'Daily generation failed; seeded fallback applies on next request');
      }
      try {
        await ensureCatalogDepth(prisma, config, new Date());
      } catch (error) {
        log?.error(error, 'Catalog top-up failed; existing catalog depth is unchanged');
      }
      tick();
    }, delay);
    if (typeof timer.unref === 'function') timer.unref();
  };
  tick();
}
