import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (!process.env.DATABASE_URL) {
  console.error("Database check failed: DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connection succeeded. No data was changed.");
  } catch (error) {
    console.error("Database connection failed:", error instanceof Error ? error.name : "Unknown error");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
