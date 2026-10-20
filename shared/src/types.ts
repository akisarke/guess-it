import type { GameSourceRef, GeneratedQuestionSetSummary } from './generated-sets.js';

export type AuthProvider = 'anonymous' | 'hackclub';
export type QuestionSource = 'daily' | 'ai_generated' | 'ai_daily';
export type QueueStatus = 'waiting' | 'matched' | 'expired';
export type ScoreDirection = 'Too Low' | 'Too High' | 'Exact';
export type ScoreBand = 'close' | 'medium' | 'far';

export interface User {
  id: string;
  displayName: string;
  authProvider: AuthProvider;
  hackclubId: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isDeveloper: boolean;
  isOwner: boolean;
  createdAt: string;
}

export interface Question {
  id: string;
  prompt: string;
  unit: string;
  answer: number;
  napkinMath: string;
  source: QuestionSource;
  createdBy: string | null;
  topic: string | null;
  createdAt: string;
}

export interface QuestionPublic {
  id: string;
  prompt: string;
  unit: string;
}

export interface Guess {
  id: string;
  userId: string;
  questionId: string;
  value: number;
  score: number;
  createdAt: string;
}

export interface DailyPuzzle {
  id: string;
  puzzleNumber: number;
  puzzleDate: string;
  questionIds: string[];
  questions?: QuestionPublic[];
}

export interface Streak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayedOn: string | null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  isSecret: boolean;
  isManualGrant: boolean;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  grantedAt: string;
  grantedBy: string | null;
  note: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  badge?: Badge;
}

export interface Match {
  id: string;
  puzzleId: string;
  playerA: string;
  playerB: string;
  createdAt: string;
}

export interface QueueEntry {
  id: string;
  userId: string;
  questionId: string | null;
  queuedAt: string;
  status: QueueStatus;
}

export interface PuzzleResponse {
  source: GameSourceRef;
  puzzle: DailyPuzzle;
  questions: QuestionPublic[];
  userGuesses: Record<string, number>;
}

export interface ArchivePuzzle {
  puzzleNumber: number;
  puzzleDate: string;
  questions: QuestionPublic[];
}

export interface ArchiveResponse {
  puzzles: ArchivePuzzle[];
  hasMore: boolean;
}

export interface GuessRequest {
  source: GameSourceRef;
  questionId: string;
  value: number;
}

export interface GuessResponse {
  score: number;
  answer: number;
  direction: ScoreDirection;
  scoreBand: ScoreBand;
}

export interface DistributionBin {
  low: number;
  high: number;
  count: number;
}

export interface DistributionResponse {
  bins: DistributionBin[];
  userGuess: number | null;
  medianGuess: number;
  answer: number;
  napkinMath: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface ProfileResponse {
  user: User;
  streak: Streak | null;
  badges: UserBadge[];
  pinnedBadges: UserBadge[];
  generatedSets: readonly GeneratedQuestionSetSummary[];
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  pinnedBadges: UserBadge[];
  isHackClubMember: boolean;
}

export interface BadgeDef extends Badge {
  earned: boolean;
  earnedAt?: string;
}

export interface AdminGrantRequest {
  userId: string;
  badgeId: 'ownerspick';
  note?: string;
}

export function getScoreBand(score: number): ScoreBand {
  if (score <= 1.5) return 'close';
  if (score <= 3.0) return 'medium';
  return 'far';
}
