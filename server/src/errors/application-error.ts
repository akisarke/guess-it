import type { ErrorCode } from 'shared';

export abstract class ApplicationError extends Error {
  protected constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly resetAt?: string,
    readonly resetAtMs?: number,
    options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(400, options?.code ?? 'VALIDATION_ERROR', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(401, options?.code ?? 'AUTHENTICATION_REQUIRED', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(403, options?.code ?? 'FORBIDDEN', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(404, options?.code ?? 'NOT_FOUND', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(409, options?.code ?? 'CONFLICT', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(429, options?.code ?? 'RATE_LIMITED', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(503, options?.code ?? 'SERVICE_UNAVAILABLE', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class ExternalServiceGatewayError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(502, options?.code ?? 'SERVICE_UNAVAILABLE', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(500, options?.code ?? 'CONFIGURATION_ERROR', message, options?.resetAt, options?.resetAtMs, options);
  }
}

export class InvariantError extends ApplicationError {
  constructor(message: string, options?: { code?: ErrorCode; resetAt?: string; resetAtMs?: number } & ErrorOptions) {
    super(500, options?.code ?? 'INTERNAL_ERROR', message, options?.resetAt, options?.resetAtMs, options);
  }
}
