-- CreateTable Etapa + scope existing data under the first etapa.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Backfill: the current seeded tournament (Etapa 5 fixture) becomes the first etapa.
INSERT INTO "Etapa" ("id", "name", "date", "sortOrder", "createdAt", "updatedAt")
VALUES ('etapa-e5', 'Etapa 5', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RedefineTables: Match gains etapaId
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'GROUPS',
    "zone" TEXT,
    "slot" INTEGER NOT NULL,
    "timeLabel" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "sets" JSONB,
    "setFormat" TEXT,
    "resultStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "winnerId" TEXT,
    "recordedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("createdAt", "id", "recordedAt", "resultStatus", "slot", "stage", "teamAId", "teamBId", "timeLabel", "updatedAt", "winnerId", "zone", "etapaId")
SELECT "createdAt", "id", "recordedAt", "resultStatus", "slot", "stage", "teamAId", "teamBId", "timeLabel", "updatedAt", "winnerId", "zone", 'etapa-e5' FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_etapaId_idx" ON "Match"("etapaId");

-- RedefineTables: Team gains etapaId
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("createdAt", "id", "name", "updatedAt", "zone", "etapaId")
SELECT "createdAt", "id", "name", "updatedAt", "zone", 'etapa-e5' FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE INDEX "Team_etapaId_idx" ON "Team"("etapaId");

-- RedefineTables: TournamentState becomes per-etapa (id TEXT, unique etapaId)
DROP TABLE "TournamentState";
CREATE TABLE "TournamentState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'GROUPS',
    "zoneConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "prepMinutes" INTEGER NOT NULL DEFAULT 5,
    "matchMinutes" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TournamentState_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "TournamentState" ("id", "etapaId", "phase", "zoneConfirmed", "prepMinutes", "matchMinutes", "updatedAt")
SELECT 'ts-etapa-e5', 'etapa-e5', "phase", "zoneConfirmed", "prepMinutes", "matchMinutes", "updatedAt" FROM "TournamentState";
CREATE UNIQUE INDEX "TournamentState_etapaId_key" ON "TournamentState"("etapaId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;