-- Corrective migration: the closedAt migration (20260925100000) wrongly
-- redefined Etapa with denormalized flat columns ("teams"/"matches"/"state"
-- as TEXT NOT NULL) that do not exist in the relational schema. Restore the
-- relational shape: Etapa holds only its own scalar fields; the relations
-- (teams, matches, state) live on the child tables via etapaId.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Etapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Etapa" ("id", "name", "date", "sortOrder", "closedAt", "createdAt", "updatedAt")
SELECT "id", "name", "date", "sortOrder", "closedAt", "createdAt", "updatedAt" FROM "Etapa";
DROP TABLE "Etapa";
ALTER TABLE "new_Etapa" RENAME TO "Etapa";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;