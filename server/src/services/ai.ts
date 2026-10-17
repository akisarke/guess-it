import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { ServerConfig } from '../config.js';

export type GenerationInput = Readonly<{
  readonly topic: string;
  readonly difficulty: 'easy' | 'medium' | 'hard' | null;
  readonly excludedPrompts?: readonly string[];
}>;

export type GeneratedQuestion = Readonly<{
  readonly prompt: string;
  readonly unit: string;
  readonly answer: number;
  readonly napkinMath: string;
}>;

export type GeneratedQuestionBatch = readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion];

const generatedQuestionSchema = z.object({
  prompt: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  answer: z.number().finite().min(0.01).max(1e15),
  napkinMath: z.string().trim().min(1),
});

const generatedQuestionsSchema = z.tuple([generatedQuestionSchema, generatedQuestionSchema, generatedQuestionSchema]);

const generationSchemas = {
  set: {
    kind: 'set',
    json: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          unit: { type: 'string' },
          answer: { type: 'number' },
          napkinMath: { type: 'string' },
        },
        required: ['prompt', 'unit', 'answer', 'napkinMath'],
      },
    },
  },
  single: {
    kind: 'single',
    json: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        unit: { type: 'string' },
        answer: { type: 'number' },
        napkinMath: { type: 'string' },
      },
      required: ['prompt', 'unit', 'answer', 'napkinMath'],
    },
  },
} as const;

type GenerationSchema = (typeof generationSchemas)[keyof typeof generationSchemas];

import { ConfigurationError, ExternalServiceError } from '../errors/application-error.js';

export type AiConfig = Readonly<{ readonly apiKey: string; readonly model: string }>;

export class AiConfigurationError extends ConfigurationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class AiProviderError extends ExternalServiceError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class AiResponseError extends ExternalServiceError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export interface GenerationProvider {
  generateContent(input: Readonly<{ readonly prompt: string; readonly model: string; readonly schema: GenerationSchema }>): Promise<string>;
}

export function resolveAiConfig(
  environment: Readonly<{ readonly GEMINI_API_KEY?: string; readonly GEMINI_MODEL?: string }>,
): AiConfig {
  const apiKey = environment.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiConfigurationError('Gemini API key is not configured');

  const configuredModel = environment.GEMINI_MODEL;
  const model = configuredModel === undefined ? 'gemini-2.5-flash' : configuredModel.trim();
  if (!model || !/^[A-Za-z0-9._/:~-]+$/.test(model)) throw new AiConfigurationError('Gemini model configuration is invalid');

  return { apiKey, model };
}

export function parseGeneratedQuestions(text: string): readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new AiResponseError('AI response was not valid JSON', { cause: error });
  }

  try {
    return generatedQuestionsSchema.parse(json);
  } catch (error) {
    throw new AiResponseError('AI response did not match the required question schema', { cause: error });
  }
}

export function parseGeneratedQuestion(text: string): GeneratedQuestion {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new AiResponseError('AI response was not valid JSON', { cause: error });
  }

  try {
    return generatedQuestionSchema.parse(json);
  } catch (error) {
    throw new AiResponseError('AI response did not match the required question schema', { cause: error });
  }
}

function createGoogleProvider(apiKey: string): GenerationProvider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateContent(input) {
      try {
        const response = await ai.models.generateContent({
          model: input.model,
          contents: input.prompt,
          config: { responseMimeType: 'application/json', responseJsonSchema: input.schema.json },
        });
        const text = response.text;
        if (!text) throw new AiProviderError('AI provider returned no response text');
        return text;
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw new AiProviderError('AI provider request failed', { cause: error });
      }
    },
  };
}

export function createFailoverProvider(providers: readonly GenerationProvider[]): GenerationProvider {
  return {
    async generateContent(input) {
      let lastError: unknown;
      for (const provider of providers) {
        try {
          return await provider.generateContent(input);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof AiProviderError
        ? lastError
        : new AiProviderError('AI provider request failed (all API keys failed)', { cause: lastError });
    },
  };
}

function resolveGenerationConfig(config: ServerConfig, provider?: GenerationProvider): Readonly<{ readonly provider: GenerationProvider; readonly model: string }> {
  if (provider) return { provider, model: config.gemini?.model ?? 'gemini-2.5-flash' };
  if (!config.gemini) throw new AiConfigurationError('Gemini API key is not configured');
  return { provider: createFailoverProvider(config.gemini.apiKeys.map(createGoogleProvider)), model: config.gemini.model };
}

export async function generateQuestionSet(
  input: GenerationInput,
  config: ServerConfig,
  provider?: GenerationProvider,
): Promise<readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion]> {
  const { provider: selectedProvider, model } = resolveGenerationConfig(config, provider);
  const excluded = input.excludedPrompts?.filter(Boolean) ?? [];
  const exclusion = excluded.length > 0 ? ` Do not repeat any of these existing questions: ${excluded.map((value) => JSON.stringify(value)).join('; ')}` : '';
  const prompt = `Generate exactly three estimation questions about ${input.topic} at ${input.difficulty ?? 'medium'} difficulty.${exclusion} Return the requested structured JSON. napkinMath must be line-based: one line per factor in the form Label: value (2-4 factor lines; include approximate markers like ~ when needed), followed by a final multiplication and approximate result using ≈ (for example, 23 × 10 ≈ 230). Do not include other prose in napkinMath.`;
  const responseText = await selectedProvider.generateContent({ prompt, model, schema: generationSchemas.set });
  const questions = parseGeneratedQuestions(responseText);
  const blocked = new Set(excluded.map((value) => value.trim().toLocaleLowerCase()));
  if (questions.some((question) => blocked.has(question.prompt.trim().toLocaleLowerCase()))) throw new AiResponseError('AI returned a question already used by today’s daily puzzle.');
  return questions;
}

export async function generateQuestion(
  topic: string,
  difficulty?: string,
  config?: ServerConfig,
  provider?: GenerationProvider,
  excludedPrompts: readonly string[] = [],
): Promise<GeneratedQuestion> {
  const normalizedDifficulty = difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard' ? difficulty : null;
  if (!config) throw new AiConfigurationError('Server configuration is required');
  const { provider: selectedProvider, model } = resolveGenerationConfig(config, provider);
  const exclusion = excludedPrompts.length > 0
    ? ` Do not repeat any of these existing questions: ${excludedPrompts.map((value) => JSON.stringify(value)).join('; ')}`
    : '';
  const prompt = `Generate one estimation question about ${topic} at ${normalizedDifficulty ?? 'medium'} difficulty.${exclusion} Return the requested structured JSON. napkinMath must be line-based: one line per factor in the form Label: value (2-4 factor lines; include approximate markers like ~ when needed), followed by a final multiplication and approximate result using ≈ (for example, 23 × 10 ≈ 230). Do not include other prose in napkinMath.`;
  const responseText = await selectedProvider.generateContent({ prompt, model, schema: generationSchemas.single });
  const question = parseGeneratedQuestion(responseText);
  const blocked = new Set(excludedPrompts.map((value) => value.trim().toLocaleLowerCase()));
  if (blocked.has(question.prompt.trim().toLocaleLowerCase())) throw new AiResponseError('AI returned a question already used by a previous daily puzzle.');
  return question;
}
