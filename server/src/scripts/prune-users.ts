import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { parsePruneConfig, pruneUsersKeeping } from '../services/user-prune.js';
import { loadConfig } from '../config.js';

const prisma = new PrismaClient();

try {
  const config = parsePruneConfig(process.env);
  const serverConfig = loadConfig();
  const remaining = await prisma.user.findMany({ where: { displayName: config.keepDisplayName }, select: { displayName: true } });
  const counts = await pruneUsersKeeping(prisma, config, serverConfig.avatarUploadDir);
  console.log(`Deleted ${counts.users} users, ${counts.guesses} guesses, ${counts.streaks} streaks, ${counts.badges} badges, ${counts.queueEntries} queue entries, ${counts.duels} duels.`);
  console.log(`Kept ${remaining.map((user) => user.displayName).join(', ')} (id ${counts.keptUserId}).`);
} finally {
  await prisma.$disconnect();
}