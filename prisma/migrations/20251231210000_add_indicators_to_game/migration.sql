-- AlterTable
ALTER TABLE "games" ADD COLUMN     "money" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "games" ADD COLUMN     "power" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "games" ADD COLUMN     "popularity" INTEGER NOT NULL DEFAULT 50;

-- AddCheckConstraint
ALTER TABLE "games" ADD CONSTRAINT "games_money_check" CHECK ("money" >= 0 AND "money" <= 100);
ALTER TABLE "games" ADD CONSTRAINT "games_power_check" CHECK ("power" >= 0 AND "power" <= 100);
ALTER TABLE "games" ADD CONSTRAINT "games_popularity_check" CHECK ("popularity" >= 0 AND "popularity" <= 100);



