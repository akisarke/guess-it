import type { DuelClientCommand, DuelServerEvent } from 'shared';

export interface DuelConnection {
  send(command: DuelClientCommand): void;
  close(): void;
}

interface DuelSocketHandlers {
  readonly onEvent: (event: DuelServerEvent) => void;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  readonly onError?: (error: Error) => void;
}

function isDuelServerEvent(value: unknown): value is DuelServerEvent {
  if (typeof value !== 'object' || value === null || !('type' in value) || !('version' in value)) return false;
  const type = value.type;
  return typeof type === 'string' && type.startsWith('duel.') && typeof value.version === 'number';
}

function socketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
  return `${apiUrl.replace(/^http/, 'ws')}/api/duels/socket`;
}

export function connectDuelSocket(handlers: DuelSocketHandlers): DuelConnection {
  const socket = new WebSocket(socketUrl());
  socket.addEventListener('open', () => handlers.onOpen?.());
  socket.addEventListener('message', (event) => {
    try {
      const parsed: unknown = JSON.parse(String(event.data));
      if (isDuelServerEvent(parsed)) handlers.onEvent(parsed);
    } catch (error: unknown) {
      handlers.onError?.(error instanceof Error ? error : new Error('Invalid duel event.'));
    }
  });
  socket.addEventListener('close', () => handlers.onClose?.());
  socket.addEventListener('error', () => handlers.onError?.(new Error('Duel connection failed.')));
  return {
    send: (command) => socket.send(JSON.stringify(command)),
    close: () => socket.close(),
  };
}
