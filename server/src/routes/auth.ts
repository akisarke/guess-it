import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '../middleware/auth.js';
import { setSessionCookie, textField } from '../services/auth-helpers.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { recordFailedPasswordLogin } from '../services/login-state.js';
import { registerHackClubAuthRoutes } from './hackclub-auth.js';
import { buildLimiterKey, semanticLimit } from '../services/rate-limit.js';
import { AuthenticationError, ConflictError, ValidationError } from '../errors/application-error.js';
import { AuthorizationError, ExternalServiceError } from '../errors/application-error.js';
import { createEmailVerificationToken, consumeEmailVerificationToken } from '../services/email-verification.js';
import { sendEmailVerificationEmail } from '../services/email.js';
import { decodeSession } from '../services/session.js';
import { containsBlockedWord } from '../services/word-blacklist.js';

function privateAuthUser(user: {
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
   createdAt: Date;
   emailVerifiedAt: Date | null;
}) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    authProvider: user.authProvider,
    hackclubId: user.hackclubId,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    usernameChosen: user.usernameChosen,
    isDeveloper: user.isDeveloper,
    isOwner: user.isOwner,
    createdAt: user.createdAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
}

function normalizedEmail(value: unknown): string | undefined {
  const email = textField(value, 'email')?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export async function authRoutes(app: FastifyInstance) {
  const prisma = app.prisma;
  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/anonymous', { preHandler: semanticLimit('anonymousIp', (request) => buildLimiterKey('anonymous-ip', request.ip)) }, async (request, reply) => {
    const currentUser = await getSessionUser(request);
    const user = currentUser ?? await prisma.user.create({
      data: { displayName: `anon-${randomUUID()}`, authProvider: 'anonymous' },
    });
    setSessionCookie(reply, user.id, user.sessionVersion, app.config);
     return { user: privateAuthUser(user) };
  });

  app.post('/signup', { preHandler: semanticLimit('signupIp', (request) => buildLimiterKey('signup-ip', request.ip)) }, async (request, reply) => {
    const currentUser = await getSessionUser(request);
    const email = normalizedEmail(request.body);
    const password = textField(request.body, 'password');
    const displayName = textField(request.body, 'displayName')?.trim();

    if (!email) throw new ValidationError('Enter a valid email address.');
    if (!password || password.length < 8 || password.length > 128) {
      throw new ValidationError('Use a password between 8 and 128 characters.');
    }
    if (!displayName || displayName.length < 2 || displayName.length > 32) {
      throw new ValidationError('Choose a display name between 2 and 32 characters.');
    }
    if (containsBlockedWord(displayName)) throw new ValidationError('Remove the blocked word from your text.');

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { displayName }], ...(currentUser ? { NOT: { id: currentUser.id } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ConflictError('That email or display name is already in use.');
    if (currentUser && currentUser.authProvider !== 'anonymous') {
      throw new ConflictError('This signed-in account is already registered.');
    }

    const passwordHash = await hashPassword(password);
    const user = currentUser
      ? await prisma.user.update({
          where: { id: currentUser.id },
          data: { displayName, email, passwordHash, authProvider: 'password', emailVerifiedAt: null },
        })
      : await prisma.user.create({
          data: { displayName, email, passwordHash, authProvider: 'password', emailVerifiedAt: null },
        });
    const token = await createEmailVerificationToken(prisma, user.id, new Date());
    try {
      await sendEmailVerificationEmail(email, token, app.config);
    } catch (error) {
      request.log.error({ errorType: error instanceof Error ? error.name : 'unknown' }, 'Verification email failed');
      throw new ExternalServiceError('We could not send the verification email. Try again shortly.', { cause: error });
    }
    reply.clearCookie(app.config.session.cookieName, { path: '/' });
    return { user: privateAuthUser(user), migratedFromAnonymous: currentUser !== null, pendingVerification: true };
  });

  app.post('/login', { preHandler: [semanticLimit('loginIp', (request) => buildLimiterKey('login-ip', request.ip)), semanticLimit('loginAccount', (request) => {
    const email = normalizedEmail(request.body);
    return email ? buildLimiterKey('login-account', email) : undefined;
  })] }, async (request, reply) => {
    const email = normalizedEmail(request.body);
    const password = textField(request.body, 'password');
    if (!email || !password) throw new ValidationError('Enter your email and password.');

    const user = await prisma.user.findUnique({ where: { email } });
    const isLocked = user?.lockedUntil !== undefined && user.lockedUntil !== null && user.lockedUntil > new Date();
    const valid = !isLocked && user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      if (user?.passwordHash && !isLocked) await recordFailedPasswordLogin(prisma, user.id, new Date());
      throw new AuthenticationError('Incorrect email or password.');
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    if (user.authProvider !== 'anonymous' && user.emailVerifiedAt === null) {
      return { user: privateAuthUser(user), pendingVerification: true };
    }
    setSessionCookie(reply, user.id, user.sessionVersion, app.config);
    return { user: privateAuthUser(user) };
  });

  registerHackClubAuthRoutes(app);

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(app.config.session.cookieName, { path: '/' });
    return { success: true };
  });

  app.get('/me', async (request) => {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Not authenticated');
    return { user: privateAuthUser(user) };
  });

  app.get('/verify-email', { preHandler: semanticLimit('resetPasswordTokenPrefix', (request) => {
    const token = textField(request.query, 'token');
    return token ? buildLimiterKey('reset-token', token) : undefined;
  }) }, async (request, reply) => {
    const token = textField(request.query, 'token');
    if (!token) throw new ValidationError('That verification link is invalid or expired.');
    await consumeEmailVerificationToken(prisma, token, new Date());
    return reply.redirect(`${app.config.appUrl}/verify-email?verified=1`);
  });

  app.post('/resend-verification', { preHandler: [semanticLimit('forgotPasswordIp', (request) => buildLimiterKey('verification-ip', request.ip)), semanticLimit('forgotPasswordAccount', (request) => {
    const email = normalizedEmail(request.body);
    return email ? buildLimiterKey('verification-account', email) : undefined;
  })] }, async (request) => {
    const email = normalizedEmail(request.body);
    const generic = { message: 'If an account is eligible, a verification email is on its way.' };
    if (!email) return generic;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.authProvider === 'anonymous' || user.emailVerifiedAt !== null) return generic;
    const token = await createEmailVerificationToken(prisma, user.id, new Date());
    try { await sendEmailVerificationEmail(email, token, app.config); } catch (error) {
      request.log.error({ errorType: error instanceof Error ? error.name : 'unknown' }, 'Verification resend failed');
    }
    return generic;
  });

  app.patch('/verification-email', { preHandler: [
    semanticLimit('signupIp', (request) => buildLimiterKey('verification-email-ip', request.ip)),
    semanticLimit('signupIp', (request) => {
      const cookie = request.cookies[request.server.config.session.cookieName];
      const unsigned = cookie ? request.unsignCookie(cookie) : null;
      const session = unsigned?.valid && unsigned.value ? decodeSession(unsigned.value, Date.now(), request.server.config) : null;
      return session ? buildLimiterKey('verification-email-user', session.userId) : undefined;
    }),
  ] }, async (request) => {
    const user = await getSessionUser(request);
    const email = normalizedEmail(request.body);
    if (!user || user.authProvider === 'anonymous' || user.emailVerifiedAt !== null) throw new AuthorizationError('Email verification is required.', { code: 'EMAIL_VERIFICATION_REQUIRED' });
    if (!email) throw new ValidationError('Enter a valid email address.');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) throw new ConflictError('That email is already in use.');
    const updated = await prisma.user.update({ where: { id: user.id }, data: { email } });
    const token = await createEmailVerificationToken(prisma, user.id, new Date());
    try { await sendEmailVerificationEmail(email, token, app.config); } catch (error) {
      request.log.error({ errorType: error instanceof Error ? error.name : 'unknown' }, 'Verification email update failed');
      throw new ExternalServiceError('We could not send the verification email. Try again shortly.', { cause: error });
    }
    return { user: privateAuthUser(updated), pendingVerification: true };
  });
}
