-- Repechaje bracket format migration
-- Adds BracketFormat enum and bracketFormat column to Etapa.
-- Stage enum members REPECHAJE_1, REPECHAJE_2, BRONZE are added in schema.prisma;
-- SQLite stores enums as TEXT so no SQL ALTER needed for the enum extension.

ALTER TABLE "Etapa" ADD COLUMN "bracketFormat" TEXT NOT NULL DEFAULT 'STANDARD';
