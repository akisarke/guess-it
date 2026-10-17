type ResendResponse = { readonly id?: string; readonly message?: string };
import type { ServerConfig } from '../config.js';
import { ConfigurationError, ExternalServiceGatewayError } from '../errors/application-error.js';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export async function sendPasswordResetEmail(email: string, token: string, config: ServerConfig): Promise<void> {
  if (!config.email) throw new Error('Resend email configuration is missing');

  const resetUrl = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.email.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
       from: config.email.from,
      to: [email],
      subject: 'Reset your Guess It! password',
      html: `<p>We received a request to reset your Guess It! password.</p><p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const body: ResendResponse = await response.json();
  if (!response.ok) throw new Error(body.message || `Resend request failed with status ${response.status}`);
}

export async function sendEmailVerificationEmail(email: string, token: string, config: ServerConfig): Promise<void> {
  if (!config.email) throw new ConfigurationError('Resend email configuration is missing');

  const verificationUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const safeVerificationUrl = escapeHtml(verificationUrl);
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.email.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.email.from,
        to: [email],
        subject: 'Verify your Guess It! email',
        html: `<p>Thanks for signing up for Guess It!</p><p><a href="${safeVerificationUrl}">Verify your email address</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ExternalServiceGatewayError('Verification email delivery failed', { cause: error });
  }
  if (!response.ok) throw new ExternalServiceGatewayError(`Verification email delivery failed with status ${response.status}`);
}
