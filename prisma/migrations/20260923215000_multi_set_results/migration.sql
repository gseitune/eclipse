-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("createdAt", "id", "recordedAt", "resultStatus", "slot", "stage", "teamAId", "teamBId", "timeLabel", "updatedAt", "winnerId", "zone") SELECT "createdAt", "id", "recordedAt", "resultStatus", "slot", "stage", "teamAId", "teamBId", "timeLabel", "updatedAt", "winnerId", "zone" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Dev-side data fix (ADDENDUM #1): the slot-1 "2-1 COMPLETE" artifact recorded
-- before win-by-2 validation (15-14 style score) is not a legal result. Reset
-- it so the organizer re-records it under the new rules.
UPDATE "Match"
SET "resultStatus" = 'PENDING',
    "winnerId" = NULL,
    "recordedAt" = NULL,
    "sets" = NULL,
    "setFormat" = NULL
WHERE "slot" = 1 AND "resultStatus" = 'COMPLETE';