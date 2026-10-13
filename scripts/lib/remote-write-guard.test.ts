import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOW_REMOTE_ENV,
  ALLOW_REMOTE_FLAG,
  RemoteWriteRefused,
  assertRemoteWriteAllowed,
  maskDatabaseUrl,
  resolveDatabaseTarget,
} from "./remote-write-guard";

const LOCAL_URL = "file:D:/Proyectos/Eclipse/04-Codigo/eclipse-app/prisma/dev.db";
const REMOTE_URL = "libsql://eclipse-etapa6-gaso.turso.io?authToken=super-secret-token";
const TOKEN = "super-secret-token";

function guard(
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[] = [],
) {
  const logged: string[] = [];
  return {
    logged,
    options: {
      script: "cleanup-test-etapas.ts",
      action: "delete the test etapas",
      argv,
      env,
      log: (message: string) => logged.push(message),
    },
  };
}

test("maskDatabaseUrl hides credentials and tokens but keeps the scheme and host", () => {
  const masked = maskDatabaseUrl("libsql://user:pass@db.turso.io?authToken=abc123");
  assert.equal(masked.includes("abc123"), false);
  assert.equal(masked.includes(":pass@"), false);
  assert.equal(masked.includes("db.turso.io"), true);
});

test("a local file database passes without ceremony", () => {
  const { options, logged } = guard({ DATABASE_URL: LOCAL_URL });
  assert.doesNotThrow(() => assertRemoteWriteAllowed(options));
  assert.deepEqual(logged, []);
});

test("a remote database is refused unless --allow-remote is passed", () => {
  const { options } = guard({ DATABASE_URL: REMOTE_URL });
  assert.throws(
    () => assertRemoteWriteAllowed(options),
    (error: unknown) => {
      assert.ok(error instanceof RemoteWriteRefused);
      const message = (error as Error).message;
      assert.equal(message.includes(TOKEN), false);
      assert.equal(message.includes(ALLOW_REMOTE_FLAG), true);
      assert.equal(message.includes("cleanup-test-etapas.ts"), true);
      return true;
    },
  );
});

test("--allow-remote permits the write and warns loudly without leaking the token", () => {
  const { options, logged } = guard({ DATABASE_URL: REMOTE_URL }, [ALLOW_REMOTE_FLAG]);
  assert.doesNotThrow(() => assertRemoteWriteAllowed(options));
  assert.equal(logged.length, 1);
  assert.equal(logged[0].includes("REMOTE"), true);
  assert.equal(logged[0].includes(TOKEN), false);
});

test("the env escape hatch permits the write too", () => {
  const { options, logged } = guard(
    { DATABASE_URL: REMOTE_URL, [ALLOW_REMOTE_ENV]: "1" },
  );
  assert.doesNotThrow(() => assertRemoteWriteAllowed(options));
  assert.equal(logged.length, 1);
});

test("an unrelated env value does not open the escape hatch", () => {
  const { options } = guard({ DATABASE_URL: REMOTE_URL, [ALLOW_REMOTE_ENV]: "0" });
  assert.throws(() => assertRemoteWriteAllowed(options), RemoteWriteRefused);
});

test("refuses when no database url is set at all", () => {
  const { options } = guard({});
  assert.throws(() => assertRemoteWriteAllowed(options), /DATABASE_URL/);
});

test("TURSO_DATABASE_URL is the target when DATABASE_URL is absent", () => {
  assert.equal(resolveDatabaseTarget({ TURSO_DATABASE_URL: REMOTE_URL }).kind, "remote");
  assert.equal(resolveDatabaseTarget({ DATABASE_URL: LOCAL_URL }).kind, "local");
});
