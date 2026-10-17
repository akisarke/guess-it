import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseDuelId, parsePlayerId, type DuelClientCommand } from 'shared';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { DuelCoordinator } from '../services/duels/coordinator.js';
import { decideWebSocketOrigin } from '../security/origins.js';
import type { DuelCommandLimiter } from '../services/duels/command-limiter.js';
import { AuthorizationError } from '../errors/application-error.js';

interface DuelSocket {
  send(payload: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'message' | 'close' | 'error', listener: (payload?: { toString(): string }) => void): void;
}

const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('duel.subscribe'), duelId: z.string().min(1) }),
  z.object({ type: z.literal('duel.submit_answer'), duelId: z.string().min(1), roundIndex: z.number().int().min(0).max(2), value: z.number().finite().positive() }),
  z.object({ type: z.literal('duel.leave'), duelId: z.string().min(1) }),
]);

function parseCommand(payload: string): DuelClientCommand {
  const parsed = commandSchema.safeParse(parseJson(payload));
  if (!parsed.success) throw new Error('Invalid duel command.');
  const command = parsed.data;
  const duelId = parseDuelId(command.duelId);
  switch (command.type) {
    case 'duel.subscribe': return { type: command.type, duelId };
    case 'duel.leave': return { type: command.type, duelId };
    case 'duel.submit_answer': return { type: command.type, duelId, roundIndex: command.roundIndex, value: command.value };
    default: return command satisfies never;
  }
}

function parseJson(payload: string): unknown {
  return JSON.parse(payload);
}

export async function duelSocketRoutes(app: FastifyInstance, options: { readonly coordinator: DuelCoordinator; readonly commandLimiter: DuelCommandLimiter }) {
  const validateOrigin = async (request: FastifyRequest, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    if (!decideWebSocketOrigin(origin, request.server.config.clientOrigins)) throw new AuthorizationError('WebSocket origin not allowed');
  };
  app.get('/socket', { websocket: true, preHandler: [validateOrigin, authenticate, requireRegistered] }, (socket: DuelSocket, request: FastifyRequest) => {
    const userId = request.userId;
    if (!userId) {
      socket.close(1008, 'Not authenticated');
      return;
    }
    const playerId = parsePlayerId(userId);
    let subscribed: { readonly duelId: ReturnType<typeof parseDuelId> } | null = null;
    const send = (event: unknown) => socket.send(JSON.stringify(event));

    socket.on('message', (payload) => {
      try {
        if (!options.commandLimiter.allow(playerId)) {
          if (subscribed) send({ type: 'duel.error', duelId: subscribed.duelId, version: 0, code: 'COMMAND_RATE_LIMITED', message: 'Too many commands.' });
          else socket.close(1008, 'Command rate limit exceeded');
          return;
        }
        const command = parseCommand(payload?.toString() ?? '');
        if (command.type === 'duel.subscribe') {
          void options.coordinator.subscribe(command.duelId, playerId, send).catch((error: unknown) => {
            send({ type: 'duel.error', duelId: command.duelId, version: 0, code: error instanceof Error ? error.name : 'DUEL_ERROR', message: error instanceof Error ? error.message : 'Unable to subscribe.' });
          });
          subscribed = { duelId: command.duelId };
          return;
        }
        if (!subscribed || subscribed.duelId !== command.duelId) {
          send({ type: 'duel.error', duelId: command.duelId, version: 0, code: 'NOT_SUBSCRIBED', message: 'Subscribe to the duel first.' });
          return;
        }
         void options.coordinator.handle(command, playerId).catch((error: unknown) => {
           send({ type: 'duel.error', duelId: command.duelId, version: 0, code: error instanceof Error ? error.name : 'DUEL_ERROR', message: error instanceof Error ? error.message : 'Unable to handle duel command.' });
         });
      } catch (error: unknown) {
        send({ type: 'duel.error', duelId: subscribed?.duelId ?? parseDuelId('unknown'), version: 0, code: 'INVALID_COMMAND', message: error instanceof Error ? error.message : 'Invalid duel command.' });
      }
    });
    socket.on('close', () => {
       if (subscribed) void options.coordinator.handle({ type: 'duel.leave', duelId: subscribed.duelId }, playerId);
    });
    socket.on('error', () => undefined);
  });
}
