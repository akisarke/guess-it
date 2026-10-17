import { PrismaClient } from '@prisma/client';

const BIN_COUNT = 20;

export async function computeDistribution(
  prisma: PrismaClient,
  questionId: string,
  userId?: string
): Promise<{
  bins: { low: number; high: number; count: number }[];
  userGuess: number | null;
  medianGuess: number;
  answer: number;
  napkinMath: string;
  sourceTitle: string;
  sourceUrl: string;
}> {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new Error('Question not found');

  const answer = Number(question.answer);
  const guesses = await prisma.guess.findMany({
    where: { questionId },
    select: { value: true, userId: true },
  });

  if (guesses.length === 0) {
    return {
      bins: [],
      userGuess: null,
      medianGuess: answer,
      answer,
      napkinMath: question.napkinMath,
      sourceTitle: question.sourceTitle,
      sourceUrl: question.sourceUrl,
    };
  }

  const values = guesses.map(g => Number(g.value)).sort((a, b) => a - b);

  // User's guess
  const userGuessRecord = userId
    ? guesses.find(g => g.userId === userId)
    : null;
  const userGuess = userGuessRecord ? Number(userGuessRecord.value) : null;

  // Median
  const mid = Math.floor(values.length / 2);
  const medianGuess = values.length % 2 !== 0
    ? values[mid]
    : (values[mid - 1] + values[mid]) / 2;

  // Log-scale bins spanning ~1 order of magnitude each side of answer
  const logAnswer = Math.log10(answer || 1);
  const logMin = logAnswer - 1;
  const logMax = logAnswer + 1;
  const logStep = (logMax - logMin) / BIN_COUNT;

  const bins: { low: number; high: number; count: number }[] = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    const low = Math.pow(10, logMin + i * logStep);
    const high = Math.pow(10, logMin + (i + 1) * logStep);
    bins.push({ low: Math.round(low), high: Math.round(high), count: 0 });
  }

  // Bin the guesses
  for (const v of values) {
    const logV = Math.log10(v || 1);
    let binIdx = Math.floor((logV - logMin) / logStep);
    binIdx = Math.max(0, Math.min(binIdx, BIN_COUNT - 1));
    bins[binIdx].count++;
  }

  return { bins, userGuess, medianGuess, answer, napkinMath: question.napkinMath, sourceTitle: question.sourceTitle, sourceUrl: question.sourceUrl };
}
