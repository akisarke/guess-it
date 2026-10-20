export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'GENERATION_QUOTA_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  resetAt?: string;
  resetAtMs?: number;
}
