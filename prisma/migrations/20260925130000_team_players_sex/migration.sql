-- AddColumn maleName, femaleName on Team (mixto fijo: each team is exactly
-- one male + one female player; nullable so existing rows keep working).
ALTER TABLE "Team" ADD COLUMN "maleName" TEXT;
ALTER TABLE "Team" ADD COLUMN "femaleName" TEXT;