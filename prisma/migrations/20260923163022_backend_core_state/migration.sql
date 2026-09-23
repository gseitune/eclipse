-- AlterTable
ALTER TABLE "Match" ADD COLUMN "recordedAt" DATETIME;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "phase" TEXT NOT NULL DEFAULT 'GROUPS',
    "zoneConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "prepMinutes" INTEGER NOT NULL DEFAULT 5,
    "matchMinutes" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
