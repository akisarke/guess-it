import { Prisma, type PrismaClient } from '@prisma/client';

const LOCKOUT_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1_000;

type LoginStateRow = Readonly<{ failedLoginAttempts: number; lockedUntil: Date | null }>;

function parseLoginState(row: LoginStateRow | undefined): LoginStateRow | null {
  if (!row || !Number.isInteger(row.failedLoginAttempts) || row.failedLoginAttempts < 0) return null;
  if (row.lockedUntil !== null && !(row.lockedUntil instanceof Date)) return null;
  return row;
}

export async function recordFailedPasswordLogin(prisma: PrismaClient, userId: string, now: Date): Promise<LoginStateRow | null> {
  const rows = await prisma.$queryRaw<LoginStateRow[]>(Prisma.sql`
    UPDATE "User"
    SET "failedLoginAttempts" = "failedLoginAttempts" + 1,
        "lockedUntil" = CASE
          WHEN "failedLoginAttempts" + 1 >= ${LOCKOUT_ATTEMPTS}
            THEN ${new Date(now.getTime() + LOCKOUT_DURATION_MS)}
          ELSE "lockedUntil"
        END
    WHERE "id" = ${userId} AND "passwordHash" IS NOT NULL
      AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
    RETURNING "failedLoginAttempts", "lockedUntil"
  `);
  if (rows.length === 0) return null;
  const state = parseLoginState(rows[0]);
  if (!state) throw new Error('Password login state update returned invalid data');
  return state;
}
