import { describe, expect, test } from 'vitest';
import { AiConfigurationError, AiProviderError, createFailoverProvider, generateQuestion, generateQuestionSet, parseGeneratedQuestions, resolveAiConfig, type GenerationProvider } from './ai.js';
import { loadConfig } from '../config.js';

const testConfig = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 't'.repeat(64), CLIENT_ORIGINS: 'http://localhost:5173', APP_URL: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost:5432/guessit', TRUST_PROXY: 'loopback', HACKCLUB_CLIENT_ID: 'test', HACKCLUB_CLIENT_SECRET: 's'.repeat(32), HACKCLUB_REDIRECT_URI: 'http://localhost:3001/callback', GEMINI_API_KEY: 'test-key' });

const question = {
  prompt: 'How many cups fit in a bathtub?',
  unit: 'CUPS',
  answer: 1000,
  napkinMath: 'A bathtub holds about 250 liters and a cup is 0.25 liters.',
};

const batch = () => [question, { ...question }, { ...question }];

describe('parseGeneratedQuestions', () => {
  test('accepts exactly three complete questions', () => {
    const result = parseGeneratedQuestions(JSON.stringify(batch()));

    expect(result).toHaveLength(3);
    expect(result[0]?.answer).toBe(1000);
  });

  test('rejects a batch with fewer than three questions', () => {
    expect(() => parseGeneratedQuestions(JSON.stringify(batch().slice(0, 2)))).toThrow();
  });

  test('rejects a batch with more than three questions', () => {
    expect(() => parseGeneratedQuestions(JSON.stringify([...batch(), question]))).toThrow();
  });

  test('rejects missing napkin math', () => {
    const invalid = batch().map(({ napkinMath: _napkinMath, ...item }) => item);

    expect(() => parseGeneratedQuestions(JSON.stringify(invalid))).toThrow();
  });

  test('rejects null, malformed non-finite, or coerced answers', () => {
    const nullAnswer = batch().map((item) => ({ ...item, answer: null }));
    const coerced = batch().map((item) => ({ ...item, answer: '1000' }));
    const malformed = JSON.stringify(batch()).replace('1000', 'NaN');

    expect(() => parseGeneratedQuestions(JSON.stringify(nullAnswer))).toThrow();
    expect(() => parseGeneratedQuestions(JSON.stringify(coerced))).toThrow();
    expect(() => parseGeneratedQuestions(malformed)).toThrow();
  });

  test('rejects answers outside the supported range', () => {
    const tooSmall = batch().map((item) => ({ ...item, answer: 0 }));
    const tooLarge = batch().map((item) => ({ ...item, answer: 1e15 + 1 }));

    expect(() => parseGeneratedQuestions(JSON.stringify(tooSmall))).toThrow();
    expect(() => parseGeneratedQuestions(JSON.stringify(tooLarge))).toThrow();
  });

  test('rejects empty prompt, unit, and napkin math values', () => {
    for (const field of ['prompt', 'unit', 'napkinMath'] as const) {
      const invalid = batch().map((item) => ({ ...item, [field]: '  ' }));

      expect(() => parseGeneratedQuestions(JSON.stringify(invalid))).toThrow();
    }
  });
});

describe('generateQuestionSet', () => {
  test('uses the documented default model with an injected provider', async () => {
    let selectedModel = '';
    const provider: GenerationProvider = {
      generateContent: async ({ model }) => {
        selectedModel = model;
        return JSON.stringify(batch());
      },
    };

    const result = await generateQuestionSet({ topic: 'scale', difficulty: null }, testConfig, provider);

    expect(selectedModel).toBe('gemini-2.5-flash');
    expect(result).toHaveLength(3);
  });

  test('rejects missing configuration when no provider is injected', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(generateQuestionSet({ topic: 'scale', difficulty: null }, { ...testConfig, gemini: null })).rejects.toBeInstanceOf(AiConfigurationError);

    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
});

describe('generateQuestion', () => {
  test('requests one structured question without using the batch generator', async () => {
    let requestedSchema = '';
    const provider: GenerationProvider = {
      generateContent: async ({ schema }) => {
        requestedSchema = schema.kind;
        return JSON.stringify(question);
      },
    };

    const result = await generateQuestion('scale', 'medium', testConfig, provider);

    expect(requestedSchema).toBe('single');
    expect(result.answer).toBe(1000);
  });
});

const quotaError = () => new AiProviderError('AI provider request failed', { cause: Object.assign(new Error('You exceeded your current quota'), { status: 429 }) });

describe('createFailoverProvider', () => {
  test('falls back to the next key when the current one is quota-exhausted', async () => {
    const calls: string[] = [];
    const failing: GenerationProvider = { generateContent: async () => { calls.push('first'); throw quotaError(); } };
    const working: GenerationProvider = { generateContent: async () => { calls.push('second'); return JSON.stringify(batch()); } };

    const result = await generateQuestionSet({ topic: 'scale', difficulty: null }, testConfig, createFailoverProvider([failing, working]));

    expect(calls).toEqual(['first', 'second']);
    expect(result).toHaveLength(3);
  });

  test('continues to the next key on non-quota provider failures too', async () => {
    const calls: string[] = [];
    const failing: GenerationProvider = { generateContent: async () => { calls.push('first'); throw new AiProviderError('AI provider request failed', { cause: new Error('boom') }); } };
    const working: GenerationProvider = { generateContent: async () => { calls.push('second'); return JSON.stringify(batch()); } };

    const result = await generateQuestionSet({ topic: 'scale', difficulty: null }, testConfig, createFailoverProvider([failing, working]));

    expect(calls).toEqual(['first', 'second']);
    expect(result).toHaveLength(3);
  });

  test('fails with AiProviderError when every key fails', async () => {
    let attempts = 0;
    const failing: GenerationProvider = { generateContent: async () => { attempts += 1; throw Object.assign(new Error('boom'), { status: 500 }); } };

    await expect(generateQuestionSet({ topic: 'scale', difficulty: null }, testConfig, createFailoverProvider([failing, failing, failing]))).rejects.toBeInstanceOf(AiProviderError);
    expect(attempts).toBe(3);
  });
});

describe('resolveAiConfig', () => {
  test('rejects a whitespace API key before provider construction', () => {
    expect(() => resolveAiConfig({ GEMINI_API_KEY: '   ' })).toThrow(AiConfigurationError);
  });

  test('rejects whitespace and invalid model names before provider construction', () => {
    expect(() => resolveAiConfig({ GEMINI_API_KEY: 'key', GEMINI_MODEL: '   ' })).toThrow(AiConfigurationError);
    expect(() => resolveAiConfig({ GEMINI_API_KEY: 'key', GEMINI_MODEL: 'gemini 2.5 flash' })).toThrow(AiConfigurationError);
  });

  test('trims valid configuration and defaults an absent model', () => {
    expect(resolveAiConfig({ GEMINI_API_KEY: ' key ', GEMINI_MODEL: ' gemini-2.5-flash ' })).toEqual({ apiKey: 'key', model: 'gemini-2.5-flash' });
    expect(resolveAiConfig({ GEMINI_API_KEY: 'key' }).model).toBe('gemini-2.5-flash');
  });
});
