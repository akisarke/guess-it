import type { FastifyInstance } from 'fastify';
import { hashPassword } from '../services/passwords.js';
import { createPasswordResetToken, resetPassword } from '../services/password-reset.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { buildLimiterKey, semanticLimit } from '../services/rate-limit.js';
import { ExternalServiceError, ValidationError } from '../errors/application-error.js';

function textField(value: unknown, field: string): string | undefined {
  if (typeof value !== 'object' || value === null || !(field in value)) return undefined;
  const text: unknown = Reflect.get(value, field);
  return typeof text === 'string' && text.trim().length > 0 ? text : undefined;
}

function normalizedEmail(value: unknown): string | undefined {
  const email = textField(value, 'email')?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

const genericResponse = { message: 'If an account exists, a reset email is on its way.' };

export async function passwordResetRoutes(app: FastifyInstance) {
  app.post('/forgot-password', { preHandler: [semanticLimit('forgotPasswordIp', (request) => buildLimiterKey('forgot-password-ip', request.ip)), semanticLimit('forgotPasswordAccount', (request) => {
    const email = normalizedEmail(request.body);
    return email ? buildLimiterKey('forgot-password-account', email) : undefined;
  })] }, async (request) => {
    const email = normalizedEmail(request.body);
    if (!email) throw new ValidationError('Enter a valid email address.');

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user || user.authProvider !== 'password' || !user.passwordHash) return genericResponse;

    try {
      const token = await createPasswordResetToken(app.prisma, user.id);
      await sendPasswordResetEmail(email, token, app.config);
    } catch (error) {
      request.log.error({ errorType: error instanceof Error ? error.name : 'unknown' }, 'Password reset email failed');
      throw new ExternalServiceError('We could not send the reset email. Try again shortly.', { cause: error });
    }
    return genericResponse;
  });

  app.post('/reset-password', { preHandler: [semanticLimit('resetPasswordIp', (request) => buildLimiterKey('reset-password-ip', request.ip)), semanticLimit('resetPasswordTokenPrefix', (request) => {
    const token = textField(request.body, 'token');
    return token ? buildLimiterKey('reset-token', token) : undefined;
  })] }, async (request) => {
    const token = textField(request.body, 'token');
    const password = textField(request.body, 'password');
    if (!token || !password) throw new ValidationError('Reset token and password are required.');
    if (password.length < 8 || password.length > 128) {
      throw new ValidationError('Use a password between 8 and 128 characters.');
    }

    const passwordHash = await hashPassword(password);
    const consumed = await resetPassword(app.prisma, { token, passwordHash, now: new Date() });
    if (!consumed) throw new ValidationError('That reset link is invalid or expired.');
    return { message: 'Your password has been reset. You can now sign in.' };
  });
}
