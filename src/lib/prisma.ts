import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 removed the old `prisma-client-js` generator (and with it, the
 * built-in Rust query engine). The client is now generated as plain
 * TypeScript into `src/generated/prisma` (see prisma/schema.prisma), and
 * talking to Postgres requires an explicit driver adapter instead of an
 * auto-bundled engine binary.
 */

function buildAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Add it to your .env file (see .env.example)."
    );
  }
  return new PrismaPg({ connectionString });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: buildAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
