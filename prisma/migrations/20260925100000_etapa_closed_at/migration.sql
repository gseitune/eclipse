-- AddColumn closedAt on Etapa
CREATE TABLE "new_Etapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "teams" TEXT NOT NULL,
    "matches" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Etapa" ("createdAt", "date", "id", "matches", "name", "sortOrder", "state", "teams", "updatedAt", "closedAt")
SELECT "createdAt", "date", "id", "matches", "name", "sortOrder", "state", "teams", "updatedAt", NULL FROM "Etapa";
DROP TABLE "Etapa";
ALTER TABLE "new_Etapa" RENAME TO "Etapa";
