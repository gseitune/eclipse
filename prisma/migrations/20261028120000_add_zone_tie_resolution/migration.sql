-- CreateTable
CREATE TABLE "ZoneTieResolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ZoneTieResolution_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoneTieResolution_etapaId_zone_key" ON "ZoneTieResolution"("etapaId", "zone");
