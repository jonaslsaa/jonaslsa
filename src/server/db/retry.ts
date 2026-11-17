import { Prisma } from "@prisma/client";

// Railway's MySQL service sleeps when idle; the first query after a wake-up
// often fails with "Server has closed the connection" (P1017) or can't reach
// the server yet (P1001/P1002). Retry those a few times with backoff.
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const RETRY_DELAYS_MS = [1000, 3000, 6000];

function isRetryableDbError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_CODES.has(error.code);
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return /closed the connection|can't reach database|connection reset/i.test(error.message);
  }
  return false;
}

export async function withDbRetry<T>(fn: () => Promise<T>, label = "db query"): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryableDbError(error)) throw error;
      console.warn(`${label} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
