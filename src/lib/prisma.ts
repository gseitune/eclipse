import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDbConfig } from "./db-config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const { databaseUrl, authToken, source } = resolveDbConfig(process.env);

// Surface which env var won the resolution so a wrong database in production
// is visible in the Vercel logs at a glance (never log the URL or token).
console.log(`[DB] connection source: ${source}`);

// Local SQLite keeps the zero-setup path; remote libsql:// URLs (Turso on
// Vercel) go through the libSQL adapter so the exact same code serves both.
const adapter = databaseUrl.startsWith("file:")
  ? new PrismaBetterSqlite3({ url: databaseUrl })
  : new PrismaLibSql({
      url: databaseUrl,
      authToken,
    });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}