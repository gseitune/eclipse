import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// Vercel's Turso storage creates TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
// DATABASE_URL is the local sqlite var and may be present-but-empty on the
// server, so empty strings are skipped instead of short-circuiting the chain.
const databaseUrl =
  nonEmpty(process.env.TURSO_DATABASE_URL) ??
  nonEmpty(process.env.DATABASE_URL) ??
  "file:./dev.db";
const authToken =
  nonEmpty(process.env.TURSO_AUTH_TOKEN) ??
  nonEmpty(process.env.DATABASE_AUTH_TOKEN);

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