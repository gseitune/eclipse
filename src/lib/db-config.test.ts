import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDbConfig } from "./db-config";

const ECLIPSE_URL = "libsql://selvarena-db-mother.turso.io";
const TURSO_BRANCH_URL = "libsql://dpl-abc123-vercel.turso.io";

test("ECLIPSE_DATABASE_URL wins over the Vercel-injected Turso URL", () => {
  const config = resolveDbConfig({
    ECLIPSE_DATABASE_URL: ECLIPSE_URL,
    TURSO_DATABASE_URL: TURSO_BRANCH_URL,
    DATABASE_URL: "file:./dev.db",
  });
  assert.equal(config.databaseUrl, ECLIPSE_URL);
  assert.equal(config.source, "eclipse-override");
});

test("ECLIPSE_DATABASE_AUTH_TOKEN wins over the injected token", () => {
  const config = resolveDbConfig({
    ECLIPSE_DATABASE_AUTH_TOKEN: "eclipse-token",
    TURSO_AUTH_TOKEN: "branch-token",
    DATABASE_AUTH_TOKEN: "other-token",
  });
  assert.equal(config.authToken, "eclipse-token");
});

test("without ECLIPSE vars the previous chain is unchanged", () => {
  const config = resolveDbConfig({
    TURSO_DATABASE_URL: TURSO_BRANCH_URL,
    TURSO_AUTH_TOKEN: "branch-token",
    DATABASE_URL: "file:./dev.db",
  });
  assert.equal(config.databaseUrl, TURSO_BRANCH_URL);
  assert.equal(config.authToken, "branch-token");
  assert.equal(config.source, "turso-branch");
});

test("falls back to DATABASE_URL when no Turso var is set", () => {
  const config = resolveDbConfig({ DATABASE_URL: "file:./dev.db" });
  assert.equal(config.databaseUrl, "file:./dev.db");
  assert.equal(config.authToken, undefined);
});

test("empty or whitespace-only values are skipped, not short-circuited", () => {
  const config = resolveDbConfig({
    ECLIPSE_DATABASE_URL: "  ",
    TURSO_DATABASE_URL: TURSO_BRANCH_URL,
    TURSO_AUTH_TOKEN: "",
  });
  assert.equal(config.databaseUrl, TURSO_BRANCH_URL);
  assert.equal(config.authToken, undefined);
});

test("defaults to local sqlite when nothing is set", () => {
  const config = resolveDbConfig({});
  assert.equal(config.databaseUrl, "file:./dev.db");
  assert.equal(config.authToken, undefined);
  assert.equal(config.source, "local-sqlite");
});

test("falls back to DATABASE_URL source label", () => {
  const config = resolveDbConfig({ DATABASE_URL: "file:./dev.db" });
  assert.equal(config.source, "database-url");
});
