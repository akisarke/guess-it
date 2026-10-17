import { PrismaClient } from '@prisma/client';
import { hashPassword } from './services/passwords.js';
import { validateCatalogQuestion } from './services/question-catalog.js';
import { loadConfig } from './config.js';

const prisma = new PrismaClient();
const serverConfig = loadConfig();

const QUESTIONS = [
  { prompt: 'How many iPhones have been produced since 2007?', unit: 'IPHONES', answer: 2500000000, napkinMath: '~17 years x ~150M/year average = ~2.5B', sourceTitle: 'Wikipedia: iPhone', sourceUrl: 'https://en.wikipedia.org/wiki/IPhone' },
  { prompt: 'How many pizzas are consumed in the US each year?', unit: 'PIZZAS', answer: 30000000000, napkinMath: '330M people x ~40 pizzas/year = ~13B, but including restaurants double to ~30B', sourceTitle: 'Wikipedia: Pizza in the United States', sourceUrl: 'https://en.wikipedia.org/wiki/Pizza_in_the_United_States' },
  { prompt: 'How many rubber ducks are manufactured each year?', unit: 'RUBBER DUCKS', answer: 50000000, napkinMath: '~50M — popular novelty item, mass produced in China', sourceTitle: 'Wikipedia: Rubber duck', sourceUrl: 'https://en.wikipedia.org/wiki/Rubber_duck' },
  { prompt: 'How many stars are visible from Earth on a clear night?', unit: 'STARS', answer: 9000, napkinMath: 'Naked eye limit ~magnitude 6, roughly 9000 visible at once', sourceTitle: 'Wikipedia: Apparent magnitude', sourceUrl: 'https://en.wikipedia.org/wiki/Apparent_magnitude' },
  { prompt: 'How many bicycles are produced worldwide each year?', unit: 'BICYCLES', answer: 100000000, napkinMath: '~100M — China alone produces ~60M', sourceTitle: 'Wikipedia: Bicycle industry', sourceUrl: 'https://en.wikipedia.org/wiki/Bicycle_industry' },
  { prompt: 'How many books are published worldwide each year?', unit: 'BOOKS', answer: 4000000, napkinMath: '~4M new titles per year globally', sourceTitle: 'Wikipedia: Books published per country per year', sourceUrl: 'https://en.wikipedia.org/wiki/Books_published_per_country_per_year' },
  { prompt: 'How many tennis balls are used at Wimbledon each year?', unit: 'TENNIS BALLS', answer: 55000, napkinMath: '~55K — each match uses ~6 balls, ~500 matches, ~6 weeks', sourceTitle: 'Wimbledon: The Official Home of Tennis', sourceUrl: 'https://www.wimbledon.com/en_GB/about_aeltc/2019-2023.html' },
  { prompt: 'How many cups of coffee are consumed worldwide each day?', unit: 'CUPS', answer: 2250000000, napkinMath: '~2.25B cups/day — ~2.25B cups/day globally', sourceTitle: 'Wikipedia: Coffee', sourceUrl: 'https://en.wikipedia.org/wiki/Coffee' },
  { prompt: 'How many airplanes are in the air at any given moment?', unit: 'AIRPLANES', answer: 10000, napkinMath: '~10K — ~100K flights/day, average flight ~10 hours', sourceTitle: 'Wikipedia: Flight tracking', sourceUrl: 'https://en.wikipedia.org/wiki/Flight_tracking' },
  { prompt: 'How many LEGO bricks have been produced since 1958?', unit: 'LEGO BRICKS', answer: 400000000000, napkinMath: '~400B bricks, ~75 billion/year in recent years', sourceTitle: 'Wikipedia: Lego', sourceUrl: 'https://en.wikipedia.org/wiki/Lego' },
];

async function main() {
  void serverConfig;
  console.log('Seeding database...');

  const badges = [
    { id: 'streak7', name: 'On Fire', description: '7-day play streak', isSecret: false, isManualGrant: false },
    { id: 'streak30', name: 'Unstoppable', description: '30-day play streak', isSecret: false, isManualGrant: false },
    { id: 'exact', name: 'Bullseye', description: 'Scored an exact 1.0x guess', isSecret: false, isManualGrant: false },
    { id: 'sharp', name: 'Sharpshooter', description: 'Day average score below 1.1x', isSecret: false, isManualGrant: false },
    { id: 'owner', name: 'Owner', description: 'The Guess It! owner', isSecret: false, isManualGrant: false },
    { id: 'ownerspick', name: "Owner's Pick!", description: 'Personally selected by the Guess It! owner', isSecret: false, isManualGrant: true },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: badge,
      create: badge,
    });
  }
  console.log(`Created ${badges.length} badges`);

  const createdQuestions = [];
  for (const rawQuestion of QUESTIONS) {
    const q = validateCatalogQuestion(rawQuestion);
    const question = await prisma.question.create({
      data: {
        prompt: q.prompt,
        unit: q.unit,
        answer: q.answer,
        napkinMath: q.napkinMath,
        sourceTitle: q.sourceTitle,
        sourceUrl: q.sourceUrl,
        source: 'daily',
      },
    });
    createdQuestions.push(question);
  }
  console.log(`Created ${createdQuestions.length} questions`);

  for (let i = 0; i < Math.floor(createdQuestions.length / 3); i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const questionIds = createdQuestions.slice(i * 3, i * 3 + 3).map((q) => q.id);

    await prisma.dailyPuzzle.upsert({
      where: { puzzleNumber: i },
      update: { questionIds },
      create: {
        puzzleNumber: i,
        puzzleDate: date,
        questionIds,
      },
    });
  }
  console.log('Created 10 daily puzzles');

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD;
  const owner = ownerEmail && ownerPassword
    ? await (async () => {
        const passwordHash = await hashPassword(ownerPassword);
        return prisma.user.upsert({
        where: { displayName: process.env.OWNER_DISPLAY_NAME?.trim() || 'akisarke' },
          update: { email: ownerEmail, passwordHash, authProvider: 'password', isOwner: true },
          create: { displayName: process.env.OWNER_DISPLAY_NAME?.trim() || 'akisarke', email: ownerEmail, passwordHash, authProvider: 'password', isOwner: true },
        });
      })()
    : await prisma.user.upsert({
        where: { displayName: 'developer' },
        update: {},
        create: { displayName: 'developer', authProvider: 'anonymous', isDeveloper: true, isOwner: true },
      });
  const configuredOwnerId = process.env.OWNER_USER_ID;
  const configuredOwner = configuredOwnerId
    ? await prisma.user.findUnique({ where: { id: configuredOwnerId } })
    : owner;
  if (configuredOwner) {
    if (!configuredOwner.isOwner) await prisma.user.update({ where: { id: configuredOwner.id }, data: { isOwner: true } });
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: configuredOwner.id, badgeId: 'owner' } },
      update: {},
      create: { userId: configuredOwner.id, badgeId: 'owner', isPinned: true, pinnedAt: new Date() },
    });
  }
  console.log('Created dev user');

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
