import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { parseResetConfig, resetUsers } from '../services/user-reset.js';
import { loadConfig } from '../config.js';

const prisma = new PrismaClient();

try {
  const config = parseResetConfig(process.env);
  const serverConfig = loadConfig();
  const counts = await resetUsers(prisma, config, serverConfig.avatarUploadDir);
  console.log(`Deleted ${counts.users} users and their relations.`);
  console.log(`Created owner ${config.displayName} with id ${counts.ownerId}.`);
} finally {
  await prisma.$disconnect();
}
