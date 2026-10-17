import { z } from 'zod';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigurationError } from './errors/application-error.js';

// Anchor CWD-relative defaults to the server package root so avatars survive starting the server from a different directory.
const serverRoot = fileURLToPath(new URL('../..', import.meta.url));

const environmentSchema = z.enum(['development', 'test', 'production']);

const rawEnvironmentSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  SESSION_COOKIE_SAME_SITE: z.string().optional(),
  CLIENT_ORIGINS: z.string().optional(),
  APP_URL: z.string().optional(),
  PORT: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  TLS_TERMINATED_BY_PROXY: z.string().optional(),
  HACKCLUB_CLIENT_ID: z.string().optional(),
  HACKCLUB_CLIENT_SECRET: z.string().optional(),
  HACKCLUB_REDIRECT_URI: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  AVATAR_UPLOAD_DIR: z.string().optional(),
  AVATAR_MAX_ENCODED_BYTES: z.string().optional(), AVATAR_MAX_PIXELS_PER_SIDE: z.string().optional(),
  DAILY_GEN_ENABLED: z.enum(['true', 'false']).optional(),
  DAILY_GEN_HOUR_UTC: z.string().optional(),
  DAILY_GEN_MINUTE_UTC: z.string().optional(),
  DAILY_TOPIC_REPEAT_DAYS: z.string().optional(),
  LIMIT_LOGIN_IP: z.string().optional(), LIMIT_LOGIN_ACCOUNT: z.string().optional(), LIMIT_ANONYMOUS_IP: z.string().optional(),
  LIMIT_FORGOT_PASSWORD_IP: z.string().optional(), LIMIT_FORGOT_PASSWORD_ACCOUNT: z.string().optional(), LIMIT_RESET_PASSWORD_IP: z.string().optional(),
  LIMIT_RESET_PASSWORD_TOKEN_PREFIX: z.string().optional(), LIMIT_SIGNUP_IP: z.string().optional(), LIMIT_GENERATION_IP: z.string().optional(),
  LIMIT_GENERATION_USER: z.string().optional(), LIMIT_AVATAR_IP: z.string().optional(), LIMIT_AVATAR_USER: z.string().optional(),
  DUEL_MAX_PAYLOAD_BYTES: z.string().optional(), DUEL_COMMAND_LIMIT: z.string().optional(), DUEL_COMMAND_WINDOW_MS: z.string().optional(),
}).strip();

type RawEnvironment = z.infer<typeof rawEnvironmentSchema>;
type Environment = ServerConfig['environment'];

export type ServerConfig = Readonly<{
  environment: 'development' | 'test' | 'production';
  /** Set when a trusted reverse proxy terminates TLS and forwards plain HTTP. */
  tlsTerminatedByProxy: boolean;
  databaseUrl: string;
  testDatabaseUrl?: string;
  sessionSecret: string;
  session: Readonly<{
    cookieName: string;
    maxAgeSeconds: number;
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
  }>;
  clientOrigins: readonly string[];
  appUrl: string;
  port: number;
  trustProxy: string;
  hackClub: Readonly<{ clientId: string; clientSecret: string; redirectUri: string }>;
  email: Readonly<{ apiKey: string; from: string }> | null;
  gemini: Readonly<{ apiKeys: readonly string[]; model: string }> | null;
  avatarUploadDir: string;
  avatarSecurity: Readonly<{ maxEncodedBytes: number; maxPixelsPerSide: number }>;
  dailyGeneration: Readonly<{ enabled: boolean; hourUtc: number; minuteUtc: number; repeatWindowDays: number }>;
  rateLimits: Readonly<Record<LimiterPolicyName, Readonly<{ limit: number; windowMs: number }>>>;
  duelSecurity: Readonly<{ maxPayloadBytes: number; commandLimit: number; commandWindowMs: number }>;
}>;

export const limiterPolicyNames = ['loginIp', 'loginAccount', 'anonymousIp', 'forgotPasswordIp', 'forgotPasswordAccount', 'resetPasswordIp', 'resetPasswordTokenPrefix', 'signupIp', 'generationIp', 'generationUser', 'avatarIp', 'avatarUser'] as const;
export type LimiterPolicyName = typeof limiterPolicyNames[number];

const developmentDefaults = {
  databaseUrl: 'postgresql://localhost:5432/guessit',
  sessionSecret: 'development-only-session-secret-change-me',
  clientOrigins: 'http://localhost:5173,http://127.0.0.1:5173',
  appUrl: 'http://localhost:5173',
  trustProxy: 'loopback',
  hackClubClientId: 'development-client',
  hackClubClientSecret: 'development-client-secret',
  hackClubRedirectUri: 'http://localhost:3001/api/auth/hackclub/callback',
} as const;

const invalidConfiguration = (field: string): ConfigurationError => new ConfigurationError(`Invalid configuration field: ${field}`);

const requiredValue = (mode: Environment, value: string | undefined, field: string, developmentDefault?: string): string => {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  if (mode === 'development' && developmentDefault !== undefined) return developmentDefault;
  throw invalidConfiguration(field);
};

const parseUrl = (value: string, field: string, protocols: readonly string[]): string => {
  try {
    const parsed = new URL(value);
    if (!parsed.hostname || !protocols.includes(parsed.protocol)) throw invalidConfiguration(field);
    return value;
  } catch {
    throw invalidConfiguration(field);
  }
};

const parseNumber = (value: string | undefined, fallback: number, minimum: number, maximum: number, field: string): number => {
  const parsed = value === undefined || value.trim() === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw invalidConfiguration(field);
  return parsed;
};

const parseLimiterPolicy = (mode: Environment, value: string | undefined, field: string): Readonly<{ limit: number; windowMs: number }> => {
  const raw = value?.trim();
  if (!raw) {
    if (mode === 'production') throw invalidConfiguration(field);
    return { limit: 1, windowMs: 60_000 };
  }
  const parts = raw.split(':');
  if (parts.length !== 2) throw invalidConfiguration(field);
  const limit = Number(parts[0]);
  const windowMs = Number(parts[1]);
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0 || !Number.isFinite(windowMs) || !Number.isInteger(windowMs) || windowMs <= 0) throw invalidConfiguration(field);
  return { limit, windowMs };
};

const parseSecurityNumber = (mode: Environment, value: string | undefined, fallback: number, minimum: number, maximum: number, field: string): number => {
  if (value === undefined || value.trim() === '') {
    if (mode === 'production') throw invalidConfiguration(field);
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw invalidConfiguration(field);
  return parsed;
};

const parseSameSite = (mode: Environment, value: string | undefined): 'lax' | 'strict' | 'none' => {
  const sameSite = value?.trim().toLowerCase();
  if (!sameSite) {
    if (mode === 'production') throw invalidConfiguration('SESSION_COOKIE_SAME_SITE');
    return 'lax';
  }
  if (sameSite !== 'lax' && sameSite !== 'strict' && sameSite !== 'none') throw invalidConfiguration('SESSION_COOKIE_SAME_SITE');
  if (mode === 'production' && sameSite === 'none') throw invalidConfiguration('SESSION_COOKIE_SAME_SITE');
  return sameSite;
};

const parseBoolean = (value: string | undefined, field: string): boolean => {
  const raw = value?.trim().toLowerCase();
  if (raw === undefined || raw === '') return false;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw invalidConfiguration(field);
};

const isLocalOrigin = (origin: string): boolean => {  const parsed = new URL(origin);
  return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
};

const parseOrigins = (mode: Environment, raw: string): readonly string[] => {
  const values = raw.split(',').map((value) => value.trim());
  if (values.some((value) => value === '')) throw invalidConfiguration('CLIENT_ORIGINS');

  const origins = values.map((value) => {
    if (value === '*' || value.includes('*')) throw invalidConfiguration('CLIENT_ORIGINS');
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw invalidConfiguration('CLIENT_ORIGINS');
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      throw invalidConfiguration('CLIENT_ORIGINS');
    }
    if (mode === 'production' && (parsed.protocol !== 'https:' || isLocalOrigin(value))) {
      throw invalidConfiguration('CLIENT_ORIGINS');
    }
    return parsed.origin;
  });

  return [...new Set(origins)];
};

const parseOptionalPair = (first: string | undefined, second: string | undefined, firstField: string, secondField: string): Readonly<{ first: string; second: string }> | null => {
  const firstValue = first?.trim();
  const secondValue = second?.trim();
  if (!firstValue && !secondValue) return null;
  if (!firstValue) throw invalidConfiguration(firstField);
  if (!secondValue) throw invalidConfiguration(secondField);
  return { first: firstValue, second: secondValue };
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsedEnvironment = rawEnvironmentSchema.safeParse(environment);
  if (!parsedEnvironment.success) throw invalidConfiguration('environment');
  const raw: RawEnvironment = parsedEnvironment.data;
  if (raw.NODE_ENV === undefined) throw invalidConfiguration('NODE_ENV');
  const modeResult = environmentSchema.safeParse(raw.NODE_ENV);
  if (!modeResult.success) throw invalidConfiguration('NODE_ENV');
  const mode = modeResult.data;
  const databaseUrl = parseUrl(requiredValue(mode, raw.DATABASE_URL, 'DATABASE_URL', developmentDefaults.databaseUrl), 'DATABASE_URL', ['postgres:', 'postgresql:']);
  const sessionSecret = requiredValue(mode, raw.SESSION_SECRET, 'SESSION_SECRET', developmentDefaults.sessionSecret);
  if (sessionSecret.length < 32) throw invalidConfiguration('SESSION_SECRET');
  const sessionSameSite = parseSameSite(mode, raw.SESSION_COOKIE_SAME_SITE);
  const origins = parseOrigins(mode, requiredValue(mode, raw.CLIENT_ORIGINS, 'CLIENT_ORIGINS', developmentDefaults.clientOrigins));
  const appUrl = parseUrl(requiredValue(mode, raw.APP_URL, 'APP_URL', developmentDefaults.appUrl), 'APP_URL', ['http:', 'https:']);
  if (mode === 'production' && (new URL(appUrl).protocol !== 'https:' || isLocalOrigin(appUrl))) throw invalidConfiguration('APP_URL');
  const trustProxy = requiredValue(mode, raw.TRUST_PROXY, 'TRUST_PROXY', developmentDefaults.trustProxy);
  const clientId = requiredValue(mode, raw.HACKCLUB_CLIENT_ID, 'HACKCLUB_CLIENT_ID', developmentDefaults.hackClubClientId);
  const clientSecret = requiredValue(mode, raw.HACKCLUB_CLIENT_SECRET, 'HACKCLUB_CLIENT_SECRET', developmentDefaults.hackClubClientSecret);
  const redirectUri = parseUrl(requiredValue(mode, raw.HACKCLUB_REDIRECT_URI, 'HACKCLUB_REDIRECT_URI', developmentDefaults.hackClubRedirectUri), 'HACKCLUB_REDIRECT_URI', ['http:', 'https:']);
  const emailValues = parseOptionalPair(raw.RESEND_API_KEY, raw.EMAIL_FROM, 'RESEND_API_KEY', 'EMAIL_FROM');
  const geminiApiKeys = (raw.GEMINI_API_KEY?.split(',') ?? []).map((key) => key.trim()).filter(Boolean);
  const gemini = geminiApiKeys.length > 0 ? { apiKeys: geminiApiKeys, model: raw.GEMINI_MODEL?.trim() || 'gemini-2.5-flash' } : null;
  const rateLimitEnvironment: Readonly<Record<LimiterPolicyName, string | undefined>> = {
    loginIp: raw.LIMIT_LOGIN_IP, loginAccount: raw.LIMIT_LOGIN_ACCOUNT, anonymousIp: raw.LIMIT_ANONYMOUS_IP,
    forgotPasswordIp: raw.LIMIT_FORGOT_PASSWORD_IP, forgotPasswordAccount: raw.LIMIT_FORGOT_PASSWORD_ACCOUNT, resetPasswordIp: raw.LIMIT_RESET_PASSWORD_IP,
    resetPasswordTokenPrefix: raw.LIMIT_RESET_PASSWORD_TOKEN_PREFIX, signupIp: raw.LIMIT_SIGNUP_IP, generationIp: raw.LIMIT_GENERATION_IP,
    generationUser: raw.LIMIT_GENERATION_USER, avatarIp: raw.LIMIT_AVATAR_IP, avatarUser: raw.LIMIT_AVATAR_USER,
  };
  const rateLimitFields: Readonly<Record<LimiterPolicyName, string>> = {
    loginIp: 'LIMIT_LOGIN_IP', loginAccount: 'LIMIT_LOGIN_ACCOUNT', anonymousIp: 'LIMIT_ANONYMOUS_IP', forgotPasswordIp: 'LIMIT_FORGOT_PASSWORD_IP',
    forgotPasswordAccount: 'LIMIT_FORGOT_PASSWORD_ACCOUNT', resetPasswordIp: 'LIMIT_RESET_PASSWORD_IP', resetPasswordTokenPrefix: 'LIMIT_RESET_PASSWORD_TOKEN_PREFIX',
    signupIp: 'LIMIT_SIGNUP_IP', generationIp: 'LIMIT_GENERATION_IP', generationUser: 'LIMIT_GENERATION_USER', avatarIp: 'LIMIT_AVATAR_IP', avatarUser: 'LIMIT_AVATAR_USER',
  };
  const rateLimits = Object.fromEntries(limiterPolicyNames.map((name) => [name, parseLimiterPolicy(mode, rateLimitEnvironment[name], rateLimitFields[name])])) as Record<LimiterPolicyName, Readonly<{ limit: number; windowMs: number }>>;

  return {
    environment: mode,
    databaseUrl,
    ...(raw.TEST_DATABASE_URL?.trim() ? { testDatabaseUrl: parseUrl(raw.TEST_DATABASE_URL.trim(), 'TEST_DATABASE_URL', ['postgres:', 'postgresql:']) } : {}),
    sessionSecret,
    session: {
      cookieName: 'guessit_session',
      maxAgeSeconds: 30 * 24 * 60 * 60,
       sameSite: sessionSameSite,
      secure: mode === 'production',
    },
    clientOrigins: origins,
    appUrl,
    port: parseNumber(raw.PORT, 3001, 1, 65535, 'PORT'),
    trustProxy,
  tlsTerminatedByProxy: parseBoolean(raw.TLS_TERMINATED_BY_PROXY, 'TLS_TERMINATED_BY_PROXY'),
    hackClub: { clientId, clientSecret, redirectUri },
    email: emailValues ? { apiKey: emailValues.first, from: emailValues.second } : null,
    gemini,
    avatarUploadDir: resolve(serverRoot, raw.AVATAR_UPLOAD_DIR?.trim() || 'uploads/avatars'),
    avatarSecurity: {
      maxEncodedBytes: parseNumber(raw.AVATAR_MAX_ENCODED_BYTES, 5 * 1024 * 1024, 1, 5 * 1024 * 1024, 'AVATAR_MAX_ENCODED_BYTES'),
      maxPixelsPerSide: parseNumber(raw.AVATAR_MAX_PIXELS_PER_SIDE, 4096, 1, 4096, 'AVATAR_MAX_PIXELS_PER_SIDE'),
    },
    dailyGeneration: {
      enabled: raw.DAILY_GEN_ENABLED !== 'false',
      hourUtc: parseNumber(raw.DAILY_GEN_HOUR_UTC, 0, 0, 23, 'DAILY_GEN_HOUR_UTC'),
      minuteUtc: parseNumber(raw.DAILY_GEN_MINUTE_UTC, 5, 0, 59, 'DAILY_GEN_MINUTE_UTC'),
      repeatWindowDays: parseNumber(raw.DAILY_TOPIC_REPEAT_DAYS, 14, 1, Number.MAX_SAFE_INTEGER, 'DAILY_TOPIC_REPEAT_DAYS'),
    },
    rateLimits,
    duelSecurity: {
      maxPayloadBytes: parseSecurityNumber(mode, raw.DUEL_MAX_PAYLOAD_BYTES, 16 * 1024, 1_024, 1 * 1024 * 1024, 'DUEL_MAX_PAYLOAD_BYTES'),
      commandLimit: parseSecurityNumber(mode, raw.DUEL_COMMAND_LIMIT, 20, 1, 1_000, 'DUEL_COMMAND_LIMIT'),
      commandWindowMs: parseSecurityNumber(mode, raw.DUEL_COMMAND_WINDOW_MS, 10_000, 1_000, 600_000, 'DUEL_COMMAND_WINDOW_MS'),
    },
  };
}
