-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AdvisorSender" AS ENUM ('user', 'advisor');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "user_type" "UserType" NOT NULL DEFAULT 'USER',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presets" (
    "id" TEXT NOT NULL,
    "has_provinces" BOOLEAN NOT NULL DEFAULT false,
    "advisor_prompt" TEXT NOT NULL,
    "event_prompt" TEXT NOT NULL,
    "chat_prompt" TEXT NOT NULL,
    "lore" TEXT NOT NULL DEFAULT '',
    "played_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preset_countries" (
    "id" TEXT NOT NULL,
    "preset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "independant" BOOLEAN NOT NULL,
    "owned_by" TEXT,
    "surname" TEXT,
    "svg_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preset_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preset_id" TEXT,
    "trame" TEXT NOT NULL DEFAULT '',
    "current_turn" INTEGER NOT NULL DEFAULT 1,
    "current_ingame_date" TEXT,
    "tokens_spent" INTEGER NOT NULL DEFAULT 0,
    "game_over" BOOLEAN NOT NULL DEFAULT false,
    "money" INTEGER NOT NULL DEFAULT 50,
    "power" INTEGER NOT NULL DEFAULT 50,
    "popularity" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_play" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "games_money_check" CHECK ("money" >= 0 AND "money" <= 100),
    CONSTRAINT "games_power_check" CHECK ("power" >= 0 AND "power" <= 100),
    CONSTRAINT "games_popularity_check" CHECK ("popularity" >= 0 AND "popularity" <= 100)
);

-- CreateTable
CREATE TABLE "game_countries" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "independant" BOOLEAN NOT NULL,
    "owned_by" TEXT,
    "surname" TEXT,
    "svg_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT,
    "text" TEXT NOT NULL,
    "resume" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "token_cost" INTEGER NOT NULL,
    "border_changed" BOOLEAN NOT NULL,
    "affected_countries" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "border_changes" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "previous_owner" TEXT,
    "new_owner" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "border_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_chats" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "advisor_trame" TEXT NOT NULL DEFAULT '',
    "current_turn_context" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT,
    "sender" "AdvisorSender" NOT NULL,
    "content" TEXT NOT NULL,
    "token_cost" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_chats" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "global_trame" TEXT NOT NULL DEFAULT '',
    "current_turn_context" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_chat_countries" (
    "chat_id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "country_trame" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "country_chat_countries_pkey" PRIMARY KEY ("chat_id","country_id")
);

-- CreateTable
CREATE TABLE "country_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT,
    "country_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "react" TEXT,
    "ingame_date" TEXT,
    "token_cost" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "preset_countries_preset_id_name_key" ON "preset_countries"("preset_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "game_countries_game_id_name_key" ON "game_countries"("game_id", "name");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preset_countries" ADD CONSTRAINT "preset_countries_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_countries" ADD CONSTRAINT "game_countries_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "border_changes" ADD CONSTRAINT "border_changes_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_chats" ADD CONSTRAINT "advisor_chats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "advisor_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_chats" ADD CONSTRAINT "country_chats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_chat_countries" ADD CONSTRAINT "country_chat_countries_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "country_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_chat_countries" ADD CONSTRAINT "country_chat_countries_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "game_countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_messages" ADD CONSTRAINT "country_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "country_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_messages" ADD CONSTRAINT "country_messages_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_messages" ADD CONSTRAINT "country_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
