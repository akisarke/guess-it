import { describe, expect, it } from 'vitest';
import { decideOrigin, decideWebSocketOrigin, parseExactOrigin } from './origins.js';
import { isHttpsRequired } from './http-policy.js';

describe('WebSocket Origin policy', () => {
  const allowed = ['https://play.example.test'];

  it('accepts only exact configured origins', () => {
    expect(decideWebSocketOrigin('https://play.example.test', allowed)).toBe(true);
    expect(decideWebSocketOrigin('https://play.example.test.attacker.test', allowed)).toBe(false);
    expect(decideWebSocketOrigin('https://play.example.test:443', allowed)).toBe(false);
  });

  it('rejects missing, malformed, wildcard, and unapproved origins', () => {
    expect(decideWebSocketOrigin(undefined, allowed)).toBe(false);
    expect(decideWebSocketOrigin('not-an-origin', allowed)).toBe(false);
    expect(decideWebSocketOrigin('*', allowed)).toBe(false);
    expect(decideWebSocketOrigin('https://other.example.test', allowed)).toBe(false);
  });
});

describe('exact HTTP Origin policy', () => {
  it('accepts only exact origins and rejects path-bearing values', () => {
    expect(parseExactOrigin('https://play.example.test').origin).toBe('https://play.example.test');
    expect(() => parseExactOrigin('https://play.example.test/game')).toThrow();
    expect(decideOrigin('https://play.example.test.attacker.test', ['https://play.example.test']).allowed).toBe(false);
  });
});

describe('trusted-proxy HTTPS policy', () => {
  it('requires HTTPS only for production effective protocols', () => {
    expect(isHttpsRequired('production', 'http')).toBe(true);
    expect(isHttpsRequired('production', 'https')).toBe(false);
    expect(isHttpsRequired('test', 'http')).toBe(false);
  });

  it('defaults to requiring HTTPS when no proxy termination is declared', () => {
    expect(isHttpsRequired('production', 'http', false)).toBe(true);
  });

  it('skips the protocol check when a trusted proxy terminates TLS', () => {
    // Nest's shared proxy reaches the app over HTTP and forwards proto http.
    expect(isHttpsRequired('production', 'http', true)).toBe(false);
  });
});
