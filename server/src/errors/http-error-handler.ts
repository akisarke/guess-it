import type { ErrorResponse } from 'shared';
import type { FastifyInstance } from 'fastify';
import { ApplicationError } from './application-error.js';

type FastifyLikeError = Error & {
  readonly code?: string;
  readonly statusCode?: number;
  readonly validation?: readonly unknown[];
};

function isFastifyLikeError(error: unknown): error is FastifyLikeError {
  return error instanceof Error;
}

function isValidationError(error: FastifyLikeError): boolean {
  return Array.isArray(error.validation);
}

function responseBody(error: ApplicationError): ErrorResponse {
  return {
    error: error.message,
    code: error.code,
    ...(error.resetAt === undefined ? {} : { resetAt: error.resetAt }),
    ...(error.resetAtMs === undefined ? {} : { resetAtMs: error.resetAtMs }),
  };
}

export function registerHttpErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApplicationError) {
      return reply.code(error.statusCode).send(responseBody(error));
    }

    if (isFastifyLikeError(error) && isValidationError(error)) {
      return reply.code(400).send({ error: 'Request validation failed', code: 'VALIDATION_ERROR' } satisfies ErrorResponse);
    }

    if (isFastifyLikeError(error) && error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.code(415).send({ error: error.message, code: 'VALIDATION_ERROR' } satisfies ErrorResponse);
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ErrorResponse);
  });
}
