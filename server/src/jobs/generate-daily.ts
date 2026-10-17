import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ensureDailyPuzzleForDate } from '../services/daily-generation.js';
import { loadConfig } from '../config.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  try {
const report = await ensureDailyPuzzleForDate(prisma, new Date(), loadConfig());
    console.log(JSON.stringify({ event: 'daily-generation-report', ...report }));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'daily-generation-failed',
      detail: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
