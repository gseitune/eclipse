// Environment selection for the database connection.
//
// ECLIPSE_* is our own explicit override (set in Vercel for Production) so the
// app always talks to the mother database. The Vercel×Turso integration
// injects TURSO_* pointing at a per-deployment branch (dpl-*), which resets
// visible data on every deploy — those are only a fallback.
// DATABASE_URL is the local sqlite var and may be present-but-empty on the
// server, so empty strings are skipped instead of short-circuiting the chain.
export type DbConfigEnv = Record<string, string | undefined>;

export type DbConfigSource =
  | "eclipse-override"
  | "turso-branch"
  | "database-url"
  | "local-sqlite";

export interface DbConfig {
  databaseUrl: string;
  authToken: string | undefined;
  source: DbConfigSource;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveDbConfig(env: DbConfigEnv): DbConfig {
  const databaseUrl =
    nonEmpty(env.ECLIPSE_DATABASE_URL) ??
    nonEmpty(env.TURSO_DATABASE_URL) ??
    nonEmpty(env.DATABASE_URL) ??
    "file:./dev.db";
  const authToken =
    nonEmpty(env.ECLIPSE_DATABASE_AUTH_TOKEN) ??
    nonEmpty(env.TURSO_AUTH_TOKEN) ??
    nonEmpty(env.DATABASE_AUTH_TOKEN);
  const source: DbConfigSource = nonEmpty(env.ECLIPSE_DATABASE_URL)
    ? "eclipse-override"
    : nonEmpty(env.TURSO_DATABASE_URL)
      ? "turso-branch"
      : nonEmpty(env.DATABASE_URL)
        ? "database-url"
        : "local-sqlite";
  return { databaseUrl, authToken, source };
}
