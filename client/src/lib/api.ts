import type { GuessMode, ErrorCode, GenerateQuestionSetRequest, GenerateQuestionSetResponse, PuzzleResponse, HardModePuzzleResponse, ProfileSkill, GeneratedGameSourceResponse, GeneratedGameSummaryResponse, GuessRequest, GuessResponse, DistributionResponse, GeneratedQuestionSetSummary } from 'shared';

const API_URL = import.meta.env.VITE_API_URL || '';
const HARD_MODE_EXCLUDE_PUZZLES = 500;
const HARD_MODE_EXCLUDE_QUESTIONS = 150;

export interface AuthResponse {
  user: AuthUser;
  migratedFromAnonymous?: boolean;
  pendingVerification?: boolean;
}

export class ApiError extends Error {
  status: number;
  resetAt: string | undefined;
  code: ErrorCode | undefined;
  resetAtMs: number | undefined;

  constructor(status: number, message: string, resetAt?: string, code?: ErrorCode, resetAtMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.resetAt = resetAt;
    this.code = code;
    this.resetAtMs = resetAtMs;
  }
}

const errorCodes: readonly ErrorCode[] = [
  'VALIDATION_ERROR', 'AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'RATE_LIMITED', 'GENERATION_QUOTA_EXCEEDED', 'SERVICE_UNAVAILABLE', 'CONFIGURATION_ERROR', 'INTERNAL_ERROR', 'EMAIL_VERIFICATION_REQUIRED',
];

// signed out, or signed in without an account. an unverified email is a
// different state, so that one keeps its own message
export function needsAccount(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  return error.status === 403 && error.code !== 'EMAIL_VERIFICATION_REQUIRED';
}

const GENERIC_ERROR = 'Something went wrong on our side. Try again in a moment.';
const OFFLINE_ERROR = "Can't reach Guess It! right now. Check your connection and try again.";

// Only validation and conflict messages are written for players ("That email
// is already in use"); everything else gets fixed wording so nothing technical
// ever reaches the screen.
function friendlyMessage(code: ErrorCode | undefined, serverMessage: string | undefined): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return serverMessage && serverMessage !== 'Request validation failed' ? serverMessage : "Something in that doesn't look right. Check it and try again.";
    case 'CONFLICT':
      return serverMessage ?? 'That clashes with something that already exists. Try a different value.';
    case 'AUTHENTICATION_REQUIRED':
      return 'Sign in to keep going.';
    case 'EMAIL_VERIFICATION_REQUIRED':
      return 'Verify your email to keep going.';
    case 'FORBIDDEN':
      return "You don't have access to that.";
    case 'NOT_FOUND':
      return "We couldn't find that. It may have moved or been deleted.";
    case 'RATE_LIMITED':
      return "You're going a little fast. Wait a moment and try again.";
    case 'GENERATION_QUOTA_EXCEEDED':
      return "You've used today's question generations. More unlock tomorrow.";
    default:
      return GENERIC_ERROR;
  }
}

// What to show for any caught error: API errors already carry friendly text,
// anything else (a thrown bug, a parse failure) gets the caller's placeholder.
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return errorCodes.some((code) => code === value);
}

function errorCodeForStatus(status: number): ErrorCode | undefined {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'AUTHENTICATION_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return undefined;
}

function recordFromBody(body: unknown): Record<string, unknown> | undefined {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? Object.fromEntries(Object.entries(body))
    : undefined;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  authProvider: string;
  hackclubId: string | null;
  bio: string | null;
  avatarUrl: string | null;
  usernameChosen: boolean;
  isDeveloper: boolean;
  isOwner: boolean;
  createdAt: string;
}

export interface PublicProfileUser {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isDeveloper: boolean;
  createdAt: string;
}

export interface ProfileResponse {
  user: PublicProfileUser | AuthUser | null;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastPlayedOn: string | null;
  } | null;
  skill?: ProfileSkill;
  badges: readonly ProfileBadge[];
  pinnedBadges: readonly ProfileBadge[];
  generatedSets: readonly GeneratedQuestionSetSummary[];
}

export interface ProfileBadge {
  badgeId: string;
  isPinned: boolean;
  grantedAt: string;
  badge: AdminBadge;
}

export interface ProfileUpdate {
  bio?: string | null;
  avatarUrl?: string | null;
  displayName?: string;
}

export interface AvatarUploadResponse {
  avatarUrl: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  score: number;
  rank: number;
  isHackClubMember: boolean;
  pinnedBadges?: readonly { badgeId: string; badge: { name: string; description: string } }[];
}

export interface FriendEntry {
  requestId: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
}

export interface FriendsResponse {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

export interface DuelChallengeState {
  state: 'waiting' | 'started' | 'expired';
  duelId: string;
  you: 'A' | 'B';
  opponent: { id: string; displayName: string; avatarUrl: string | null };
}

export interface QueueResult {
  status: 'idle' | 'waiting' | 'matched';
  entryId: string | null;
  match: { id: string } | null;
  isNewMatch: boolean;
}

export interface AdminBadge {
  id: string;
  name: string;
  description: string;
  isSecret: boolean;
  isManualGrant: boolean;
}

export interface NotificationItem {
  id: string;
  type: 'badge_awarded' | 'duel_invite' | 'friend_request';
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
  readAt: string | null;
  createdAt: string;
}

function notifyAuthChanged() {
  window.dispatchEvent(new Event('guessit:auth-changed'));
}

function notifyNotificationsChanged() {
  window.dispatchEvent(new Event('guessit:notifications-changed'));
}

let csrfTokenRequest: Promise<string> | undefined;

function acquireCsrfToken(): Promise<string> {
  if (!csrfTokenRequest) {
    csrfTokenRequest = request<{ csrfToken: string }>('/api/auth/csrf').then(({ csrfToken }) => csrfToken).finally(() => {
      csrfTokenRequest = undefined;
    });
  }

  return csrfTokenRequest;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? 'GET';
  const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const requestHeaders: Record<string, string> = {
    ...(typeof options?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
  };
  const callerHeaders = options?.headers;

  if (callerHeaders instanceof Headers) {
    callerHeaders.forEach((value, key) => { requestHeaders[key] = value; });
  } else if (Array.isArray(callerHeaders)) {
    for (const [key, value] of callerHeaders) requestHeaders[key] = value;
  } else if (callerHeaders) {
    Object.entries(callerHeaders).forEach(([key, value]) => { requestHeaders[key] = value; });
  }

  if (!isSafeMethod) {
    requestHeaders['x-csrf-token'] = await acquireCsrfToken();
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: requestHeaders,
    });
  } catch (networkError) {
    if (networkError instanceof DOMException && networkError.name === 'AbortError') throw networkError;
    throw new ApiError(0, OFFLINE_ERROR, undefined, 'SERVICE_UNAVAILABLE');
  }

  if (options?.redirect === 'manual' && res.type === 'opaqueredirect') {
    window.location.assign('/verify-email?verified=1');
    return undefined as T;
  }

  if (options?.redirect === 'manual' && res.status >= 300 && res.status < 400) {
    const location = res.headers.get('Location');
    try {
      if (location) {
        const target = new URL(location, window.location.origin);
        if (target.origin === window.location.origin && target.pathname === '/verify-email' && target.search === '?verified=1' && !target.hash) {
          window.location.assign(target.toString());
          return undefined as T;
        }
      }
    } catch {}
    throw new ApiError(res.status, GENERIC_ERROR);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      const code = errorCodeForStatus(res.status);
      throw new ApiError(res.status, friendlyMessage(code, undefined), undefined, code);
    }
    const record = recordFromBody(body);
    const serverMessage = typeof record?.error === 'string' && record.error.length > 0 ? record.error : undefined;
    const code = isErrorCode(record?.code) ? record.code : errorCodeForStatus(res.status);
    const message = friendlyMessage(code, serverMessage);
    const resetAt = typeof record?.resetAt === 'string' ? record.resetAt : undefined;
    const resetAtMs = typeof record?.resetAtMs === 'number' ? record.resetAtMs : undefined;
    throw new ApiError(res.status, message, resetAt, code, resetAtMs);
  }

  return res.json();
}

export function resolveApiAssetUrl(path: string | null): string | null {
  return path ? new URL(path, API_URL || window.location.origin).toString() : null;
}

export const api = {

  loginAnonymous: async (deviceId?: string) => {
    const response = await request<{ user: AuthUser }>('/api/auth/anonymous', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });
    notifyAuthChanged();
    return response;
  },

  signup: async (displayName: string, email: string, password: string) => {
    const response = await request<AuthResponse & { migratedFromAnonymous: boolean }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, password }),
    });
    notifyAuthChanged();
    return response;
  },

  login: async (email: string, password: string) => {
    const response = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    notifyAuthChanged();
    return response;
  },

  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  resendVerification: (email: string) =>
    request<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  updateVerificationEmail: (email: string) =>
    request<AuthResponse>('/api/auth/verification-email', {
      method: 'PATCH',
      body: JSON.stringify({ email }),
    }),

  verifyEmail: (token: string) => request<void>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { redirect: 'manual' }),

  loginHackClub: () => {
    window.location.href = `${API_URL}/api/auth/hackclub/start`;
  },

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  getMe: (signal?: AbortSignal) => request<{ user: AuthUser }>('/api/auth/me', signal ? { signal } : undefined),

  getTodayPuzzle: (signal?: AbortSignal) => request<PuzzleResponse>('/api/puzzle/today', signal ? { signal } : undefined),
  getPuzzle: (num: number) => request<PuzzleResponse>(`/api/puzzle/${num}`),
  getHardModePuzzle: (exclude: readonly number[] = [], excludeQuestions: readonly string[] = []) => {
    // keep only the most recent history so the query string stays under the
    // server's header size limit after many runs
    const recentPuzzles = exclude.slice(-HARD_MODE_EXCLUDE_PUZZLES);
    const recentQuestions = excludeQuestions.slice(-HARD_MODE_EXCLUDE_QUESTIONS);
    const params = new URLSearchParams();
    if (recentPuzzles.length > 0) params.set('exclude', recentPuzzles.join(','));
    if (recentQuestions.length > 0) params.set('excludeQuestions', recentQuestions.join(','));
    const query = params.toString();
    return request<HardModePuzzleResponse>(`/api/hard-mode/puzzle${query ? `?${query}` : ''}`);
  },
  submitHardModeGuess: (input: { questionId: string; value: number }) =>
    request<GuessResponse & { distribution: DistributionResponse }>('/api/hard-mode/guess', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getDistribution: (id: string, mode?: GuessMode) =>
    request<DistributionResponse>(`/api/puzzle/${encodeURIComponent(id)}/distribution${mode ? `?mode=${mode}` : ''}`),
  getQuestionSetPlay: (id: string) => request<GeneratedGameSourceResponse>(`/api/question-sets/${encodeURIComponent(id)}/play`),
  getQuestionSetSummary: (id: string) => request<GeneratedGameSummaryResponse>(`/api/question-sets/${encodeURIComponent(id)}/summary`),

  deleteGeneratedSet: (id: string) => request<{ success: boolean }>(`/api/questions/sets/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  submitGuess: async (input: GuessRequest) => {
    const response = await request<GuessResponse>('/api/guess', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    notifyNotificationsChanged();
    return response;
  },

  generateQuestionSet: (input: GenerateQuestionSetRequest): Promise<GenerateQuestionSetResponse> =>
    request<GenerateQuestionSetResponse>('/api/questions/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getQuestion: (id: string) => request<any>(`/api/questions/${id}`),

  getLeaderboard: (scope: string = 'daily', friends: boolean = false) =>
    request<LeaderboardEntry[]>(`/api/leaderboard?scope=${scope}&friends=${friends}`),

  getFriends: () => request<FriendsResponse>('/api/friends'),
  sendFriendRequest: (displayName: string) =>
    request<{ success: boolean }>('/api/friends', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    }),
  acceptFriendRequest: (requestId: string) =>
    request<{ success: boolean }>(`/api/friends/${encodeURIComponent(requestId)}/accept`, { method: 'POST' }),
  removeFriend: (requestId: string) =>
    request<{ success: boolean }>(`/api/friends/${encodeURIComponent(requestId)}`, { method: 'DELETE' }),

  getProfile: (id: string) => request<ProfileResponse>(`/api/users/${encodeURIComponent(id)}/profile`),
  getProfileByHandle: (handle: string) => request<ProfileResponse>(`/api/users/handle/${encodeURIComponent(handle)}/profile`),
  getMyProfile: (signal?: AbortSignal) => request<ProfileResponse>('/api/users/me/profile', signal ? { signal } : undefined),
  updateMyProfile: (input: ProfileUpdate) =>
    request<{ user: AuthUser }>('/api/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  unlinkHackClub: () =>
    request<{ user: AuthUser }>('/api/auth/hackclub/link', { method: 'DELETE' }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.set('avatar', file);
    return request<AvatarUploadResponse>('/api/users/me/avatar', { method: 'POST', body: form });
  },

  linkHackClub: () => {
    window.location.href = `${API_URL}/api/auth/hackclub/start?mode=link`;
  },

  getBadges: () => request<any>('/api/badges'),
  pinBadge: (badgeId: string, pin: boolean) =>
    request<any>(`/api/badges/${badgeId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  joinQueue: (puzzleId?: string, questionId?: string) =>
    request<QueueResult>('/api/queue/join', {
      method: 'POST',
      body: JSON.stringify({ puzzleId, questionId }),
    }),

  getQueueStatus: () => request<QueueResult>('/api/queue/status'),
  leaveQueue: () => request('/api/queue/leave', { method: 'POST' }),

  inviteDuel: (targetUserId: string) =>
    request<{ duelId: string; token: string }>('/api/duels/invite', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  getChallenge: (token: string) =>
    request<DuelChallengeState>(`/api/duels/challenge/${encodeURIComponent(token)}`),
  acceptChallenge: (token: string) =>
    request<{ duelId: string }>(`/api/duels/challenge/${encodeURIComponent(token)}/accept`, { method: 'POST' }),

  getNotifications: () => request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),
  markNotificationRead: (id: string) => request('/api/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => request('/api/notifications/' + encodeURIComponent(id), { method: 'DELETE' }),
  deleteAllNotifications: () => request('/api/notifications', { method: 'DELETE' }),

  adminSearchUsers: (search: string) =>
    request<any>(`/api/admin/users?search=${encodeURIComponent(search)}`),
  adminGetBadges: () => request<{ badges: AdminBadge[] }>('/api/admin/badges'),

  adminGrantBadge: (userId: string, badgeId: string, note?: string) =>
    request<any>('/api/admin/grant-badge', {
      method: 'POST',
      body: JSON.stringify({ userId, badgeId, note }),
    }),
};
