/*
  Warnings:

  - Added the required column `svg_id` to the `game_countries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `svg_id` to the `preset_countries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "game_countries" ADD COLUMN     "svg_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "preset_countries" ADD COLUMN     "svg_id" TEXT NOT NULL;
