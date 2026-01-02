-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard', 'simulation');

-- AlterTable
ALTER TABLE "games" ADD COLUMN "difficulty" "Difficulty" NOT NULL DEFAULT 'medium';


