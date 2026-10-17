import type { ErrorCode, ErrorResponse, GenerateQuestionSetRequest, GenerateQuestionSetResponse, PuzzleResponse, GeneratedGameSourceResponse, GeneratedGameSummaryResponse, GuessRequest, GuessResponse, DistributionResponse, GeneratedQuestionSetSummary } from 'shared';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AuthResponse {
  readonly user: AuthUser;
  readonly migratedFromAnonymous?: boolean;
  readonly pendingVerification?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly resetAt: string | undefined;
  readonly code: ErrorCode | undefined;
  readonly resetAtMs: number | undefined;

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
  readonly id: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly isDeveloper: boolean;
  readonly createdAt: string;
}

export interface ProfileResponse {
  readonly user: PublicProfileUser | AuthUser | null;
  readonly streak: {
    readonly currentStreak: number;
    readonly longestStreak: number;
    readonly lastPlayedOn: string | null;
  } | null;
  readonly badges: readonly ProfileBadge[];
  readonly pinnedBadges: readonly ProfileBadge[];
  readonly generatedSets: readonly GeneratedQuestionSetSummary[];
}

export interface ProfileBadge {
  readonly badgeId: string;
  readonly isPinned: boolean;
  readonly grantedAt: string;
  readonly badge: AdminBadge;
}

export interface ProfileUpdate {
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly displayName?: string;
}

export interface AvatarUploadResponse {
  readonly avatarUrl: string;
}

export interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly bio?: string | null;
  readonly score: number;
  readonly rank: number;
  readonly isHackClubMember: boolean;
  readonly pinnedBadges?: readonly { badgeId: string; badge: { name: string } }[];
}

export interface FriendEntry {
  readonly requestId: string;
  readonly user: { readonly id: string; readonly displayName: string; readonly avatarUrl: string | null };
}

export interface FriendsResponse {
  readonly friends: FriendEntry[];
  readonly incoming: FriendEntry[];
  readonly outgoing: FriendEntry[];
}

export interface DuelChallengeState {
  readonly state: 'waiting' | 'started' | 'expired';
  readonly duelId: string;
  readonly you: 'A' | 'B';
  readonly opponent: { readonly id: string; readonly displayName: string; readonly avatarUrl: string | null };
}

export interface QueueResult {
  readonly status: 'idle' | 'waiting' | 'matched';
  readonly entryId: string | null;
  readonly match: { readonly id: string } | null;
  readonly isNewMatch: boolean;
}

export interface AdminBadge {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isSecret: boolean;
  readonly isManualGrant: boolean;
}

export interface NotificationItem {
  readonly id: string;
  readonly type: 'badge_awarded' | 'duel_invite' | 'friend_request';
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string;
  readonly actionLabel: string;
  readonly readAt: string | null;
  readonly createdAt: string;
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

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: requestHeaders,
  });

  // Browsers expose an opaque-redirect response (status 0, headers hidden) for a manual
  // redirect, so a successful verify redirect never satisfies the 3xx status check below.
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
    throw new ApiError(res.status, 'Request failed');
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ApiError(res.status, 'Request failed');
    }
    const record = recordFromBody(body);
    const message = typeof record?.error === 'string' && record.error.length > 0 ? record.error : `HTTP ${res.status}`;
    const code = isErrorCode(record?.code) ? record.code : errorCodeForStatus(res.status);
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
  // Auth
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

  // Puzzle
  getTodayPuzzle: (signal?: AbortSignal) => request<PuzzleResponse>('/api/puzzle/today', signal ? { signal } : undefined),
  getPuzzle: (num: number) => request<PuzzleResponse>(`/api/puzzle/${num}`),
  getDistribution: (id: string) => request<DistributionResponse>(`/api/puzzle/${encodeURIComponent(id)}/distribution`),
  getQuestionSetPlay: (id: string) => request<GeneratedGameSourceResponse>(`/api/question-sets/${encodeURIComponent(id)}/play`),
  getQuestionSetSummary: (id: string) => request<GeneratedGameSummaryResponse>(`/api/question-sets/${encodeURIComponent(id)}/summary`),

  // Guess
  submitGuess: async (input: GuessRequest) => {
    const response = await request<GuessResponse>('/api/guess', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    notifyNotificationsChanged();
    return response;
  },

  // Questions
  generateQuestionSet: (input: GenerateQuestionSetRequest): Promise<GenerateQuestionSetResponse> =>
    request<GenerateQuestionSetResponse>('/api/questions/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getQuestion: (id: string) => request<any>(`/api/questions/${id}`),

  // Leaderboard
  getLeaderboard: (scope: string = 'daily', friends: boolean = false) =>
    request<LeaderboardEntry[]>(`/api/leaderboard?scope=${scope}&friends=${friends}`),

  // Friends
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

  // Users
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

  // Badges
  getBadges: () => request<any>('/api/badges'),
  pinBadge: (badgeId: string, pin: boolean) =>
    request<any>(`/api/badges/${badgeId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  // Matchmaking
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

  // Admin
  adminSearchUsers: (search: string) =>
    request<any>(`/api/admin/users?search=${encodeURIComponent(search)}`),
  adminGetBadges: () => request<{ badges: AdminBadge[] }>('/api/admin/badges'),

  adminGrantBadge: (userId: string, badgeId: string, note?: string) =>
    request<any>('/api/admin/grant-badge', {
      method: 'POST',
      body: JSON.stringify({ userId, badgeId, note }),
    }),
};
