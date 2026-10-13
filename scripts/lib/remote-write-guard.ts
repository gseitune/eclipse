/**
 * Remote-write guard for the one-shot scripts under scripts/.
 *
 * Why this exists: every script here reads the same DATABASE_URL /
 * TURSO_DATABASE_URL that the app uses, so exporting production credentials
 * (or leaving them exported from an earlier command in the same shell) turns a
 * helper written for a local file database into a production mutation. On
 * 2026-10-13 a reset helper run that way cleared a whole loaded tournament.
 *
 * Rule: any script under scripts/ that writes must call
 * assertRemoteWriteAllowed before its first write. A local `file:` database
 * passes silently; anything remote only proceeds with an explicit
 * `--allow-remote` argument (or ALLOW_REMOTE_WRITE=1 in the environment), and
 * says so out loud. An unset URL refuses instead of guessing.
 */

export type DatabaseKind = "local" | "remote" | "unknown";

export interface DatabaseTarget {
  kind: DatabaseKind;
  maskedUrl: string;
}

export class RemoteWriteRefused extends Error {
  readonly code = "remote_write_refused";

  constructor(message: string) {
    super(message);
    this.name = "RemoteWriteRefused";
  }
}

export const ALLOW_REMOTE_FLAG = "--allow-remote";
export const ALLOW_REMOTE_ENV = "ALLOW_REMOTE_WRITE";

export interface RemoteWriteGuardOptions {
  /** Script file name, shown in the refusal message. */
  script: string;
  /** What the script is about to write, in one line. */
  action: string;
  /** Command-line arguments; defaults to process.argv.slice(2). */
  argv?: readonly string[];
  /** Environment to read the database URL from; defaults to process.env. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Sink for the remote warning; defaults to console.warn. */
  log?: (message: string) => void;
}

/**
 * Hides credentials and tokens while keeping the scheme and host readable, so a
 * refusal can name its target without printing a secret.
 */
export function maskDatabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "(unset)";

  return trimmed
    .replace(/\/\/[^@/]*@/g, "//***@")
    .replace(
      /([?&](?:authToken|auth_token|token|api_key|apiKey|password|secret)=)[^&]*/gi,
      "$1***",
    );
}

export function resolveDatabaseTarget(
  env: Readonly<Record<string, string | undefined>>,
): DatabaseTarget {
  const raw = (env.DATABASE_URL ?? env.TURSO_DATABASE_URL ?? "").trim();
  if (raw === "") return { kind: "unknown", maskedUrl: "(unset)" };

  // Anything that is not an explicit local file is treated as remote: the guard
  // fails closed rather than trusting an unknown scheme.
  return {
    kind: raw.startsWith("file:") ? "local" : "remote",
    maskedUrl: maskDatabaseUrl(raw),
  };
}

export function assertRemoteWriteAllowed(options: RemoteWriteGuardOptions): void {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.warn(message));
  const target = resolveDatabaseTarget(env);

  if (target.kind === "local") return;

  if (target.kind === "unknown") {
    throw new RemoteWriteRefused(
      `Refusing to write from ${options.script}: neither DATABASE_URL nor ` +
        `TURSO_DATABASE_URL is set, so the target database cannot be verified. ` +
        `Point DATABASE_URL at a local file: URL, or export the production ` +
        `credentials and pass ${ALLOW_REMOTE_FLAG} to write to a remote one.`,
    );
  }

  const allowed =
    argv.includes(ALLOW_REMOTE_FLAG) || env[ALLOW_REMOTE_ENV] === "1";
  if (!allowed) {
    throw new RemoteWriteRefused(
      `Refusing to write from ${options.script}: the target database is REMOTE ` +
        `(${target.maskedUrl}) and this script would ${options.action}. ` +
        `Re-run with ${ALLOW_REMOTE_FLAG} (or ${ALLOW_REMOTE_ENV}=1) only if ` +
        `writing to a remote database is really intended.`,
    );
  }

  log(
    `WARNING: ${options.script} is writing to a REMOTE database ` +
      `(${target.maskedUrl}): ${options.action}.`,
  );
}
