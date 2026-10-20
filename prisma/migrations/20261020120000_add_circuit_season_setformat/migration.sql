-- Circuito = temporada anual: dos columnas aditivas, sin reconstruir la tabla.
-- Las etapas existentes quedan en Principiantes 2026 porque ese es el unico
-- circuito que corrio hasta hoy. La numeracion reinicia por circuito, y el
-- indice unico la garantiza en la base.
ALTER TABLE "Etapa" ADD COLUMN "circuit" TEXT NOT NULL DEFAULT 'PRINCIPIANTES';
ALTER TABLE "Etapa" ADD COLUMN "season" INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE "Etapa" ADD COLUMN "setFormat" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_circuit_season_sortOrder_key" ON "Etapa"("circuit", "season", "sortOrder");
