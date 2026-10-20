-- CreateTable
CREATE TABLE "CircuitSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuit" TEXT NOT NULL,
    "galleryFolder" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CircuitSetting_circuit_key" ON "CircuitSetting"("circuit");
