import { z } from 'zod';
import type { DailyPuzzle, QuestionPublic } from './types.js';

const duelIdSchema = z.string().min(1).brand<'DuelId'>();
const playerIdSchema = z.string().min(1).brand<'PlayerId'>();
const questionIdSchema = z.string().min(1).brand<'QuestionId'>();
const generatedQuestionSetIdSchema = z.string().min(1).brand<'GeneratedQuestionSetId'>();

export type DuelId = z.infer<typeof duelIdSchema>;
export type PlayerId = z.infer<typeof playerIdSchema>;
export type QuestionId = z.infer<typeof questionIdSchema>;
export type GeneratedQuestionSetId = z.infer<typeof generatedQuestionSetIdSchema>;

export function parseDuelId(value: string): DuelId {
  return duelIdSchema.parse(value);
}

export function parsePlayerId(value: string): PlayerId {
  return playerIdSchema.parse(value);
}

export function parseQuestionId(value: string): QuestionId {
  return questionIdSchema.parse(value);
}

export function parseGeneratedQuestionSetId(value: string): GeneratedQuestionSetId {
  return generatedQuestionSetIdSchema.parse(value);
}

export type GameSourceRef =
  | { readonly kind: 'daily'; readonly id: string }
  | { readonly kind: 'generated'; readonly id: string };

export interface GeneratedQuestionSetSummary {
  readonly id: string;
  readonly title: string;
  readonly topic: string;
  readonly difficulty: 'easy' | 'medium' | 'hard' | null;
  readonly createdAt: string;
  readonly completed: boolean;
}

export interface GeneratedQuestion {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly unit: string;
}

export interface GeneratedQuestionSet extends GeneratedQuestionSetSummary {
  readonly id: GeneratedQuestionSetId;
  readonly questions: readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion];
}

export interface GenerateQuestionSetRequest {
  readonly topic: string;
  readonly difficulty: 'easy' | 'medium' | 'hard' | null;
}

export interface GenerateQuestionSetResponse {
  readonly set: GeneratedQuestionSet;
  readonly questions: readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion];
  readonly remainingGenerations: number;
}

export interface GeneratedQuestionSetListResponse {
  readonly sets: readonly GeneratedQuestionSetSummary[];
}

interface GameSourceProgress {
  readonly questions: readonly [QuestionPublic, QuestionPublic, QuestionPublic];
  readonly userGuesses: Readonly<Record<string, number>>;
}

export interface DailyGameSourceResponse extends GameSourceProgress {
  readonly source: { readonly kind: 'daily'; readonly id: string };
  readonly puzzle: DailyPuzzle;
}

export interface GeneratedGameSourceResponse extends GameSourceProgress {
  readonly source: { readonly kind: 'generated'; readonly id: string };
  readonly set: GeneratedQuestionSetSummary;
}

export type GameSourceResponse = DailyGameSourceResponse | GeneratedGameSourceResponse;

export interface GeneratedGameSummaryResponse extends GeneratedGameSourceResponse {
  readonly completed: boolean;
  readonly averageScore: number | null;
}
