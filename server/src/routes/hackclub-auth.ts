import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { getSessionUser } from '../middleware/auth.js';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { setSessionCookie, textField } from '../services/auth-helpers.js';
import {
  AuthenticationError,
  ConflictError,
  ExternalServiceGatewayError,
  NotFoundError,
  ValidationError,
} from '../errors/application-error.js';
import { createEmailVerificationToken } from '../services/email-verification.js';
import { sendEmailVerificationEmail } from '../services/email.js';

export function getHackClubOAuthMode(query: unknown): 'link' | 'login' {
  return textField(query, 'mode') === 'link' ? 'link' : 'login';
}

export function buildTemporaryHackClubDisplayName(hackclubId: string): string {
  return `hackclub-${createHash('sha256').update(hackclubId).digest('hex').slice(0, 8)}`;
}

export function canUnlinkHackClub(user: { hackclubId: string | null; email: string | null; passwordHash: string | null }): boolean {
  return user.hackclubId !== null && user.email !== null && user.passwordHash !== null;
}

export function registerHackClubAuthRoutes(app: FastifyInstance): void {
  const prisma = app.prisma;
  const oauthConfig = app.config.hackClub;

app.delete('/hackclub/link', { preHandler: [authenticate, requireRegistered] }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) throw new AuthenticationError('Not authenticated');
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new NotFoundError('User not found');
    if (!canUnlinkHackClub(currentUser)) {
      throw new ValidationError('Add a password and email before unlinking Hack Club.');
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { hackclubId: null },
      select: {
        id: true,
        displayName: true,
        email: true,
        authProvider: true,
        hackclubId: true,
        bio: true,
        avatarUrl: true,
        usernameChosen: true,
        isDeveloper: true,
        isOwner: true,
        createdAt: true,
      },
    });
    return { user: { ...user, createdAt: user.createdAt.toISOString() } };
  });

  app.get('/hackclub/start', async (request, reply) => {
    const config = oauthConfig;
    const mode = getHackClubOAuthMode(request.query);
    const currentUser = mode === 'link' ? await getSessionUser(request) : null;
    if (mode === 'link' && !currentUser) {
      throw new AuthenticationError('Sign in before linking Hack Club');
    }
    const state = randomUUID();
    const cookieOptions = {
      signed: true,
      httpOnly: true,
      secure: app.config.environment === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 10 * 60,
    };
    reply.setCookie('oauth_state', state, cookieOptions);
    reply.setCookie('oauth_mode', mode, cookieOptions);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid profile name email',
      state,
    });
    return reply.redirect(`https://auth.hackclub.com/oauth/authorize?${params.toString()}`);
  });

  app.get('/hackclub/callback', async (request, reply) => {
    const config = oauthConfig;
    const code = textField(request.query, 'code');
    const state = textField(request.query, 'state');
    const stateCookie = request.cookies.oauth_state;
    const modeCookie = request.cookies.oauth_mode;
    const unsigned = stateCookie ? request.unsignCookie(stateCookie) : null;
    const modeUnsigned = modeCookie ? request.unsignCookie(modeCookie) : null;
    reply.clearCookie('oauth_state', { path: '/' });
    reply.clearCookie('oauth_mode', { path: '/' });
    if (!code || !state || !unsigned?.valid || state !== unsigned.value) {
      throw new ValidationError('Invalid OAuth callback');
    }

    let profile: unknown;
    try {
      const tokenResponse = await fetch('https://auth.hackclub.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenResponse.ok) {
        request.log.error({ status: tokenResponse.status }, 'OAuth token exchange failed');
        throw new ExternalServiceGatewayError('Hack Club login failed');
      }
      const token: unknown = await tokenResponse.json();
      const accessToken = textField(token, 'access_token');
      if (!accessToken) {
        request.log.error('OAuth token response is invalid');
        throw new ExternalServiceGatewayError('Hack Club login failed');
      }
      const userResponse = await fetch('https://auth.hackclub.com/oauth/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!userResponse.ok) {
        request.log.error({ status: userResponse.status }, 'OAuth profile request failed');
        throw new ExternalServiceGatewayError('Hack Club login failed');
      }
      profile = await userResponse.json();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      request.log.error({ errorType: error.name }, 'OAuth upstream request failed');
      throw new ExternalServiceGatewayError('Hack Club login failed', { cause: error });
    }

    const hackclubId = textField(profile, 'sub');
    if (!hackclubId) {
      request.log.error('OAuth profile response is invalid');
      throw new ExternalServiceGatewayError('Invalid Hack Club profile');
    }
    const mode = modeUnsigned?.valid && modeUnsigned.value === 'link' ? 'link' : 'login';
    if (mode === 'link') {
      const currentUser = await getSessionUser(request);
      if (!currentUser) throw new AuthenticationError('Sign in before linking Hack Club');
       const linkedUser = await prisma.user.findUnique({ where: { hackclubId }, select: { id: true } });
        if (linkedUser && linkedUser.id !== currentUser.id) throw new ConflictError('That Hack Club account is already linked.');
        try {
          await prisma.user.update({ where: { id: currentUser.id }, data: { hackclubId } });
       } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
           throw new ConflictError('That username or Hack Club account is already linked.', { cause: error });
         }
        throw error;
      }
       return reply.redirect(`${app.config.appUrl}/profile?linked=1`);
    }

    const rawProviderEmail = textField(profile, 'email')?.trim().toLowerCase();
    const providerEmail = rawProviderEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawProviderEmail) ? rawProviderEmail : undefined;
    let user;
    try {
      user = await prisma.user.upsert({
        where: { hackclubId },
        update: providerEmail ? { email: providerEmail } : {},
        create: { displayName: buildTemporaryHackClubDisplayName(hackclubId), authProvider: 'hackclub', hackclubId, usernameChosen: false, ...(providerEmail ? { email: providerEmail } : {}) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictError('That email is already in use.', { cause: error });
      throw error;
    }
    if (!providerEmail) {
      setSessionCookie(reply, user.id, user.sessionVersion, app.config);
      return reply.redirect(`${app.config.appUrl}/profile?pendingEmail=1`);
    }
    if (user.emailVerifiedAt === null) {
      const token = await createEmailVerificationToken(prisma, user.id, new Date());
      try { await sendEmailVerificationEmail(providerEmail, token, app.config); } catch (error) {
        request.log.error({ errorType: error instanceof Error ? error.name : 'unknown' }, 'Hack Club verification email failed');
      }
      return reply.redirect(`${app.config.appUrl}/profile?pendingVerification=1`);
    }
    setSessionCookie(reply, user.id, user.sessionVersion, app.config);
    const destination = user.usernameChosen ? '/profile?linked=1' : '/profile?setup=username';
    return reply.redirect(`${app.config.appUrl}${destination}`);
  });
}
