import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Database is not configured. Add DATABASE_URL to your .env file and restart Manpost.");
  }

  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}
