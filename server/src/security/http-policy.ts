import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyCsrfToken } from './csrf.js';
import { decideOrigin } from './origins.js';
import { AuthorizationError, ValidationError } from '../errors/application-error.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isHttpsRequired(environment: string, protocol: string, tlsTerminatedByProxy = false): boolean {
  // A reverse proxy that terminates TLS reaches us over plain HTTP and forwards
  // `x-forwarded-proto: http`, so the protocol check below can never pass. When that
  // deployment is declared, TLS is enforced at the proxy instead.
  if (tlsTerminatedByProxy) return false;
  return environment === 'production' && protocol !== 'https';
}

export async function enforceHttps(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const { environment, tlsTerminatedByProxy } = request.server.config;
  if (isHttpsRequired(environment, request.protocol, tlsTerminatedByProxy)) {
    throw new ValidationError('HTTPS_REQUIRED');
  }
}

export async function enforceMutationPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (safeMethods.has(request.method)) return;
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
  if (!decideOrigin(origin, request.server.config.clientOrigins).allowed) {
    throw new AuthorizationError('ORIGIN_NOT_ALLOWED');
  }
  if (request.cookies[request.server.config.session.cookieName] && !verifyCsrfToken(request)) {
    throw new AuthorizationError('CSRF_VALIDATION_FAILED');
  }
}

export async function addPermissionsPolicy(_request: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<unknown> {
  reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  return payload;
}
