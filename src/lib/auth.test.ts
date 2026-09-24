import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

/**
 * Tests for login by username and by email.
 * Uses a throwaway SQLite database via prisma db push,
 * mirroring the pattern in back.integration.test.ts.
 * All imports are dynamic to avoid module-level caching of PrismaClient.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "selvarena-auth-"));
const dbPath = join(dir, "test.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;

function clearPrismaCache() {
  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;
}

async function getHashPassword(): Promise<typeof import("./auth")["hashPassword"]> {
  const mod = await import("./auth");
  return mod.hashPassword;
}

async function getPrisma() {
  clearPrismaCache();
  // Force module reload to pick up new DATABASE_URL
  const mod = await import("./prisma");
  return mod.prisma;
}

async function seedUser() {
  const prisma = await getPrisma();
  const hashPassword = await getHashPassword();
  await prisma.user.create({
    data: {
      email: "gseitune59@gmail.com",
      username: "gabi",
      passwordHash: hashPassword("andi"),
    },
  });
}

describe("login by username and email", () => {
  before(async () => {
    process.env.DATABASE_URL = dbUrl;
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    await seedUser();
  });

  after(async () => {
    const prisma = await getPrisma();
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("logs in by username", async () => {
    const { login } = await import("./auth");
    const result = await login("gabi", "andi");
    assert.ok(result, "login should succeed");
    assert.equal(result!.email, "gseitune59@gmail.com");
    assert.equal(result!.username, "gabi");
  });

  it("logs in by email (compatibility)", async () => {
    const { login } = await import("./auth");
    const result = await login("gseitune59@gmail.com", "andi");
    assert.ok(result, "login by email should succeed");
    assert.equal(result!.email, "gseitune59@gmail.com");
    assert.equal(result!.username, "gabi");
  });

  it("normalizes username (trim + lowercase)", async () => {
    const { login } = await import("./auth");
    const result = await login("  GABI  ", "andi");
    assert.ok(result, "login with trimmed/lowercased username should succeed");
    assert.equal(result!.username, "gabi");
  });

  it("normalizes email (trim + lowercase)", async () => {
    const { login } = await import("./auth");
    const result = await login("  GSEITUNE59@GMAIL.COM  ", "andi");
    assert.ok(result, "login with trimmed/lowercased email should succeed");
    assert.equal(result!.email, "gseitune59@gmail.com");
  });

  it("rejects wrong password", async () => {
    const { login } = await import("./auth");
    const result = await login("gabi", "wrongpassword");
    assert.equal(result, null, "login with wrong password should return null");
  });

  it("rejects unknown username", async () => {
    const { login } = await import("./auth");
    const result = await login("unknown", "andi");
    assert.equal(result, null, "login with unknown username should return null");
  });
});
