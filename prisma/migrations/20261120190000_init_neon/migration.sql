-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "store_meta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_url" TEXT,
    "source_content" TEXT,
    "channel_count" INTEGER NOT NULL DEFAULT 0,
    "imported_at" TEXT NOT NULL DEFAULT '',
    "last_refreshed_at" TEXT,
    "auto_sync" BOOLEAN,
    "enabled" BOOLEAN,
    "last_synced_at" TEXT,
    "last_error" TEXT,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "tvg_id" TEXT,
    "tvg_logo" TEXT,
    "url" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "sport" TEXT NOT NULL DEFAULT 'other',
    "shelf" TEXT NOT NULL DEFAULT 'recent',
    "quality" TEXT NOT NULL DEFAULT 'HD',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_events" (
    "id" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "home_score" INTEGER NOT NULL DEFAULT 0,
    "away_score" INTEGER NOT NULL DEFAULT 0,
    "status_label" TEXT,
    "viewers" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'HD',
    "stream_url" TEXT NOT NULL DEFAULT '',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "home_logo_url" TEXT,
    "away_logo_url" TEXT,
    "channel_id" TEXT,
    "status" TEXT,
    "date_key" TEXT,
    "time" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "live_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_events" (
    "id" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT '',
    "date_key" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',
    "stream_url" TEXT,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "upcoming_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "headline_top" TEXT NOT NULL DEFAULT '',
    "headline_highlight" TEXT NOT NULL DEFAULT '',
    "headline_bottom" TEXT NOT NULL DEFAULT '',
    "subtitle_line_1" TEXT NOT NULL DEFAULT '',
    "subtitle_line_2" TEXT NOT NULL DEFAULT '',
    "cta_label" TEXT NOT NULL DEFAULT '',
    "bg_gradient" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "target_event_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "viewers" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "username_lower" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "viewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "user_agent" TEXT,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channels_playlist_id_idx" ON "channels"("playlist_id");

-- CreateIndex
CREATE UNIQUE INDEX "viewers_username_lower_key" ON "viewers"("username_lower");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "viewers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

