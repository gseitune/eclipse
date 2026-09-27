import { NextRequest } from "next/server";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

/**
 * Tests for POST /api/matches/[id]/times â€” organizer manual time updates.
 * Uses a throwaway SQLite database via prisma db push,
 * mirroring the pattern in back.integration.test.ts and auth.test.ts.
 * NextRequest is constructed with a session cookie for auth tests.
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "selvarena-times-"));
const dbPath = join(dir, "test.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;

let prisma: typeof import("@/lib/prisma").prisma;
let createSessionToken: typeof import("@/lib/auth").createSessionToken;
let hashPassword: typeof import("@/lib/auth").hashPassword;
let routeModule: typeof import("../app/api/matches/[id]/times/route");
let subscribeSse: typeof import("@/lib/events").subscribeSse;

let etapaId = "";
let matchId = "";
let sessionToken = "";

async function seedMatch() {
  const etapa = await prisma.etapa.create({
    data: { name: "Times test etapa", sortOrder: 1 },
  });
  etapaId = etapa.id;
  await prisma.team.createMany({
    data: [
      { id: "tA1", etapaId, name: "Alpha", zone: "A" },
      { id: "tA2", etapaId, name: "Beta", zone: "A" },
    ],
  });
  const match = await prisma.match.create({
    data: {
      id: "mt1",
      etapaId,
      stage: "GROUPS",
      zone: "A",
      slot: 1,
      teamAId: "tA1",
      teamBId: "tA2",
      resultStatus: "PENDING",
    },
  });
  matchId = match.id;
  await prisma.tournamentState.create({ data: { etapaId } });
}

describe("POST /api/matches/[id]/times", () => {
  before(async () => {
    process.env.DATABASE_URL = dbUrl;
    // Clear prisma client cache so it picks up DATABASE_URL
    (globalThis as unknown as { prisma?: unknown }).prisma = undefined;
    execSync(`npx prisma db push --url ${dbUrl}`, {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const prismaMod = await import("@/lib/prisma");
    prisma = prismaMod.prisma;
    const authMod = await import("@/lib/auth");
    createSessionToken = authMod.createSessionToken;
    hashPassword = authMod.hashPassword;
    const eventsMod = await import("@/lib/events");
    subscribeSse = eventsMod.subscribeSse;

    await seedMatch();

    const user = await prisma.user.create({
      data: {
        email: "organizer@test.com",
        username: "org",
        passwordHash: hashPassword("secret"),
      },
    });
    sessionToken = createSessionToken({ id: user.id, email: user.email });

    // Import route module after DATABASE_URL is set and DB is pushed
    routeModule = await import("../app/api/matches/[id]/times/route");
  });

  after(async () => {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  function makeRequest(body: unknown) {
    const url = new URL(`http://localhost/api/matches/${matchId}/times`);
    const req = new NextRequest(url, {
      method: "POST",
      headers: {
        cookie: `selvarena_session=${sessionToken}`,
      },
      body: JSON.stringify(body),
    });
    return routeModule.POST(req, { params: Promise.resolve({ id: matchId }) });
  }

  it("returns 401 without valid session cookie", async () => {
    const url = new URL(`http://localhost/api/matches/${matchId}/times`);
    const req = new NextRequest(url, {
      method: "POST",
      body: JSON.stringify({ startAt: "2026-01-01T13:00:00.000Z" }),
    });
    const res = await routeModule.POST(req, { params: Promise.resolve({ id: matchId }) });
    assert.equal(res.status, 401);
  });

  it("returns 404 for unknown match", async () => {
    const url = new URL(`http://localhost/api/matches/unknown-match-id/times`);
    const req = new NextRequest(url, {
      method: "POST",
      headers: {
        cookie: `selvarena_session=${sessionToken}`,
      },
      body: JSON.stringify({ startAt: "2026-01-01T13:00:00.000Z" }),
    });
    const res = await routeModule.POST(req, { params: Promise.resolve({ id: "unknown-match-id" }) });
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.reason, "unknown_match");
  });

  it("returns 400 invalid_date for malformed date", async () => {
    const res = await makeRequest({ startAt: "not-a-date" });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.reason, "invalid_date");
  });

  it("returns 400 invalid_range when endAt <= startAt", async () => {
    const res = await makeRequest({
      startAt: "2026-01-01T14:00:00.000Z",
      endAt: "2026-01-01T13:00:00.000Z",
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.reason, "invalid_range");
  });

  it("returns 409 for closed etapa", async () => {
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { closedAt: new Date() },
    });
    const res = await makeRequest({ startAt: "2026-01-01T13:00:00.000Z" });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.reason, "etapa_cerrada");
  });

  it("returns 409 for cancelled etapa", async () => {
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { closedAt: null, cancelledAt: new Date() },
    });
    const res = await makeRequest({ startAt: "2026-01-01T13:00:00.000Z" });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.reason, "etapa_cancelled");
  });

  it("returns 200 when setting both startAt and endAt", async () => {
    // Reset etapa state
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { cancelledAt: null, closedAt: null },
    });
    const res = await makeRequest({
      startAt: "2026-01-01T13:00:00.000Z",
      endAt: "2026-01-01T14:00:00.000Z",
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.match);
    assert.equal(json.match.manualStartAt, "2026-01-01T13:00:00.000Z");
    assert.equal(json.match.manualEndAt, "2026-01-01T14:00:00.000Z");
  });

  it("returns 200 and SSE fires when setting both times", async () => {
    await prisma.etapa.update({
      where: { id: etapaId },
      data: { cancelledAt: null, closedAt: null },
    });
    const events: string[] = [];
    const off = subscribeSse((e) => events.push(e.type));
    try {
      const res = await makeRequest({
        startAt: "2026-01-01T13:00:00.000Z",
        endAt: "2026-01-01T14:00:00.000Z",
      });
      assert.equal(res.status, 200);
      assert.ok(events.includes("match-times-changed"), "SSE match-times-changed fired");
    } finally {
      off();
    }
  });

  it("returns 200 when clearing with null (partial update: only endAt provided leaves startAt untouched)", async () => {
    // First set both times
    await prisma.match.update({
      where: { id: matchId },
      data: { manualStartAt: new Date("2026-01-01T13:00:00.000Z"), manualEndAt: new Date("2026-01-01T14:00:00.000Z") },
    });

    const res = await makeRequest({ endAt: null });
    assert.equal(res.status, 200);
    const json = await res.json();
    // endAt should be cleared
    assert.equal(json.match.manualEndAt, null);
    // startAt should remain untouched
    assert.equal(json.match.manualStartAt, "2026-01-01T13:00:00.000Z");
  });

  it("returns 200 when only startAt provided (partial update)", async () => {
    await prisma.match.update({
      where: { id: matchId },
      data: { manualEndAt: null, manualStartAt: null },
    });
    const res = await makeRequest({ startAt: "2026-01-01T15:00:00.000Z" });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.match.manualStartAt, "2026-01-01T15:00:00.000Z");
    // endAt should be null since it wasn't provided
    assert.equal(json.match.manualEndAt, null);
  });
});
