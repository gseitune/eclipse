// One-shot migration: copy the local SQLite database into a Turso/libSQL
// database. Reads credentials from the environment, never from the repo.
//
// Usage (PowerShell):
//   $env:TURSO_DATABASE_URL = "libsql://..."
//   $env:TURSO_AUTH_TOKEN = "<token>"
//   node scripts/migrate-to-turso.mjs
//
// The local path comes from DATABASE_URL (defaults to file:./dev.db).
// The script replays the local schema (single CREATE statements from
// sqlite_master) so the remote matches local byte-for-byte, then copies
// every row with INSERT OR REPLACE so IDs are preserved.

import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import path from "node:path";

const remoteUrl = process.env.TURSO_DATABASE_URL;
const remoteToken = process.env.TURSO_AUTH_TOKEN;
const localFile = (process.env.DATABASE_URL ?? "file:./dev.db").replace(
  /^file:/,
  ""
);

if (!remoteUrl || !remoteToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const local = new Database(path.resolve(localFile));
const remote = createClient({ url: remoteUrl, authToken: remoteToken });

const IGNORED = /^sqlite_|^_prisma_/;

function schemaStatements() {
  return local
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
       ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, rowid`
    )
    .all();
}

async function replaySchema() {
  const stmts = schemaStatements();
  const tables = [];
  const rest = [];
  for (const row of stmts) {
    if (IGNORED.test(row.name)) continue;
    if (row.type === "table") tables.push(row);
    else rest.push(row);
  }

  console.log(`Schema: ${tables.length} tables, ${rest.length} indexes/triggers`);

  for (const t of tables) {
    const quoted = `"${t.name}"`;
    await remote.execute({ sql: `DROP TABLE IF EXISTS ${quoted}` });
    await remote.execute({ sql: t.sql });
    console.log(`  table ${t.name} created`);
  }
  for (const r of rest) {
    await remote.execute({ sql: r.sql });
  }
  console.log("  schema replay complete");
}

function tableNames() {
  return local
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
       ORDER BY rowid`
    )
    .all()
    .map((r) => r.name);
}

async function copyTable(name) {
  const cols = local.prepare(`PRAGMA table_info("${name}")`).all();
  const colNames = cols.map((c) => c.name);
  const rows = local.prepare(`SELECT * FROM "${name}"`).all();

  if (rows.length === 0) {
    console.log(`  ${name}: 0 rows (nothing to copy)`);
    return;
  }

  const collist = colNames.map((c) => `"${c}"`).join(", ");
  const marks = colNames.map(() => "?").join(", ");
  const insert = `INSERT OR REPLACE INTO "${name}" (${collist}) VALUES (${marks})`;

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await remote.batch(
      chunk.map((r) => ({
        sql: insert,
        args: colNames.map((c) => {
          const v = r[c];
          return v === null ? null : v;
        }),
      })),
      "write"
    );
  }
  console.log(`  ${name}: ${rows.length} rows copied`);
}

async function verify() {
  for (const name of tableNames()) {
    const localCount = local.prepare(`SELECT COUNT(*) c FROM "${name}"`).all()[0].c;
    const remoteCount = await remote.execute({ sql: `SELECT COUNT(*) c FROM "${name}"` }).then((r) => Number(r.rows[0].c));
    const ok = localCount === remoteCount ? "OK" : "MISMATCH";
    console.log(`  verify ${name}: local=${localCount} remote=${remoteCount} ${ok}`);
  }
}

try {
  await replaySchema();
  for (const name of ["User", "Etapa", "TournamentState", "Team", "Match"]) {
    if (local.prepare(`SELECT name FROM sqlite_master WHERE name = ?`).get(name)) {
      await copyTable(name);
    }
  }
  await verify();
  console.log("Migration finished.");
} catch (err) {
  console.error("Migration FAILED:", err);
  process.exit(1);
} finally {
  local.close();
  remote.close();
}