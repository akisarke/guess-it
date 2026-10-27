import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NotFoundError } from './errors/application-error.js';
import { PrismaClient } from '@prisma/client';
import { authRoutes } from './routes/auth.js';
import { puzzleRoutes } from './routes/puzzle.js';
import { guessRoutes } from './routes/guess.js';
import { hardModeRoutes } from './routes/hard-mode.js';
import { questionRoutes } from './routes/questions.js';
import { questionSetRoutes } from './routes/question-sets.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { userRoutes } from './routes/users.js';
import { badgeRoutes } from './routes/badges.js';
import { matchmakingRoutes } from './routes/matchmaking.js';
import { adminRoutes } from './routes/admin.js';
import { passwordResetRoutes } from './routes/password-reset.js';
import { avatarRoutes } from './routes/avatar.js';
import { duelSocketRoutes } from './routes/duel-socket.js';
import { DuelCoordinator } from './services/duels/coordinator.js';
import { loadDuelState, saveDuelState } from './services/duels/repository.js';
import { AVATAR_PUBLIC_PREFIX } from './services/avatar-files.js';
import type { ServerConfig } from './config.js';
import rateLimit from '@fastify/rate-limit';
import { createDeterministicLimiterStore, type LimiterStore } from './services/rate-limit.js';
import { createDuelCommandLimiter, type DuelCommandLimiter } from './services/duels/command-limiter.js';
import { addPermissionsPolicy, enforceHttps, enforceMutationPolicy } from './security/http-policy.js';
import { issueCsrfToken } from './security/csrf.js';
import { registerHttpErrorHandler } from './errors/http-error-handler.js';
import { notificationRoutes } from './routes/notifications.js';
import { friendRoutes } from './routes/friends.js';

declare module 'fastify' {
  interface FastifyInstance {
    duelCoordinator: DuelCoordinator;
    config: ServerConfig;
    limiterStore: LimiterStore;
    duelCommandLimiter: DuelCommandLimiter;
  }
}

export interface BuildAppOptions {
  config: ServerConfig;
  prisma?: PrismaClient;
  logger?: boolean;
  duelCoordinator?: DuelCoordinator;
  limiterStore?: LimiterStore;
  clientDistDir?: string;
}

function defaultClientDistDir(): string {
  return resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'client', 'dist');
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: options.config.trustProxy });
  registerHttpErrorHandler(app);
  if (options.config.environment === 'production' && !options.limiterStore) throw new Error('Limiter store is required in production');
  const limiterStore = options.limiterStore ?? createDeterministicLimiterStore();
  app.decorate('limiterStore', limiterStore);
  app.decorate('duelCommandLimiter', createDuelCommandLimiter({ capacity: options.config.duelSecurity.commandLimit, windowMs: options.config.duelSecurity.commandWindowMs }));
  const prisma = options.prisma ?? new PrismaClient();
  app.decorate('config', options.config);
  const coordinator = options.duelCoordinator ?? new DuelCoordinator({
    loadState: (duelId) => loadDuelState(prisma, duelId, new Date()),
    persistState: (state, expectedVersion) => saveDuelState(prisma, state, expectedVersion),
  });
  app.decorate('duelCoordinator', coordinator);

  app.addHook('onRequest', enforceHttps);
  app.addHook('onSend', addPermissionsPolicy);
  app.addHook('preHandler', enforceMutationPolicy);
  await app.register(helmet, {
    global: true,
    hsts: options.config.environment === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    permittedCrossDomainPolicies: false,
    contentSecurityPolicy: {
      reportOnly: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'script-src': ["'self'", "'unsafe-inline'"],

        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],

        'img-src': ["'self'", 'data:', 'blob:', 'https://assets.hackclub.com'],
      },
    },
  });
  await app.register(cors, {
    origin: [...options.config.clientOrigins],
    credentials: true,
  });
  await app.register(cookie, { secret: options.config.sessionSecret });
  await app.register(rateLimit, { global: false });
  await app.register(websocket, { options: { maxPayload: options.config.duelSecurity.maxPayloadBytes } });
  const avatarUploadDir = resolve(options.config.avatarUploadDir);
  await mkdir(avatarUploadDir, { recursive: true });
  await app.register(multipart, {
    limits: { files: 1, parts: 1, fileSize: options.config.avatarSecurity.maxEncodedBytes },
    throwFileSizeLimit: false,
  });
  await app.register(fastifyStatic, {
    root: avatarUploadDir,
    prefix: AVATAR_PUBLIC_PREFIX,
    dotfiles: 'deny',
    index: false,
    list: false,
    decorateReply: false,
  });

  const clientDistDir = resolve(options.clientDistDir ?? defaultClientDistDir());
  if (existsSync(join(clientDistDir, 'index.html'))) {

    await app.register(fastifyStatic, {
      root: clientDistDir,
      prefix: '/',
      dotfiles: 'deny',
      index: false,
      list: false,
    });
    app.get('/', async (_request, reply) => reply.sendFile('index.html'));
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/uploads')) {
        throw new NotFoundError(`Route ${request.method} ${request.url} not found`);
      }
      return reply.sendFile('index.html');
    });
  }
  app.decorate('prisma', prisma);

  app.get('/api/auth/csrf', async (_request, reply) => ({ csrfToken: issueCsrfToken(reply, { secure: options.config.session.secure }) }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(passwordResetRoutes, { prefix: '/api/auth' });
  await app.register(puzzleRoutes, { prefix: '/api/puzzle' });
  await app.register(guessRoutes, { prefix: '/api' });
  await app.register(hardModeRoutes, { prefix: '/api/hard-mode' });
  await app.register(questionRoutes, { prefix: '/api/questions' });
  await app.register(questionSetRoutes, { prefix: '/api/question-sets' });
  await app.register(leaderboardRoutes, { prefix: '/api/leaderboard' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(avatarRoutes, { prefix: '/api/users' });
  await app.register(friendRoutes, { prefix: '/api/friends' });
  await app.register(badgeRoutes, { prefix: '/api/badges' });
  await app.register(matchmakingRoutes, { prefix: '/api' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(duelSocketRoutes, { prefix: '/api/duels', coordinator, commandLimiter: app.duelCommandLimiter });
  return app;
}
