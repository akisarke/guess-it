import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { ensureDailyPuzzleForDate, scheduleDailyGeneration, ensureCatalogDepth } from './services/daily-generation.js';
import { startDuelRunner } from './services/duels/runner.js';
import { createDeterministicLimiterStore } from './services/rate-limit.js';
import { loadConfig } from './config.js';

const prisma = new PrismaClient();
const config = loadConfig();
// In-memory limiter store. Correct for the single instance this server runs; a
// multi-instance deployment would need a shared store instead.
const app = await buildApp({ config, prisma, logger: true, limiterStore: createDeterministicLimiterStore() });
const stopDuelRunner = startDuelRunner(prisma, app.duelCoordinator, {
  onError: (error) => app.log.error(error, 'Duel deadline runner failed'),
});
const port = config.port;

if (config.dailyGeneration.enabled) {
  scheduleDailyGeneration(prisma, config, app.log);
  void ensureDailyPuzzleForDate(prisma, new Date(), config).catch((error: unknown) => {
    app.log.error(error, 'Startup daily-puzzle backfill failed; seeded fallback applies on next request');
  });
  void ensureCatalogDepth(prisma, config).catch((error: unknown) => {
    app.log.error(error, 'Startup catalog top-up failed; existing catalog depth is unchanged');
  });
}

try {
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Server running on http://localhost:${port}`);
} catch (error: unknown) {
  app.log.error(error);
  process.exit(1);
}

process.once('SIGTERM', () => {
  stopDuelRunner();
  void app.close();
});

process.once('SIGINT', () => {
  stopDuelRunner();
  void app.close();
});
