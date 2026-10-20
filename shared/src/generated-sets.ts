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
  | { kind: 'daily'; id: string }
  | { kind: 'generated'; id: string };

export interface GeneratedQuestionSetSummary {
  id: string;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  createdAt: string;
  completed: boolean;
}

export interface GeneratedQuestion {
  id: QuestionId;
  prompt: string;
  unit: string;
}

export interface GeneratedQuestionSet extends GeneratedQuestionSetSummary {
  id: GeneratedQuestionSetId;
  questions: readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion];
}

export interface GenerateQuestionSetRequest {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
}

export interface GenerateQuestionSetResponse {
  set: GeneratedQuestionSet;
  questions: readonly [GeneratedQuestion, GeneratedQuestion, GeneratedQuestion];
  remainingGenerations: number;
}

export interface GeneratedQuestionSetListResponse {
  sets: readonly GeneratedQuestionSetSummary[];
}

interface GameSourceProgress {
  questions: readonly [QuestionPublic, QuestionPublic, QuestionPublic];
  userGuesses: Record<string, number>;
}

export interface DailyGameSourceResponse extends GameSourceProgress {
  source: { kind: 'daily'; id: string };
  puzzle: DailyPuzzle;
}

export interface GeneratedGameSourceResponse extends GameSourceProgress {
  source: { kind: 'generated'; id: string };
  set: GeneratedQuestionSetSummary;
}

export type GameSourceResponse = DailyGameSourceResponse | GeneratedGameSourceResponse;

export interface GeneratedGameSummaryResponse extends GeneratedGameSourceResponse {
  completed: boolean;
  averageScore: number | null;
}
