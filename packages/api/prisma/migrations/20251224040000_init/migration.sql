-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('DISCORD');

-- CreateTable
CREATE TABLE "modpacks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "curseforge_id" TEXT,
    "modrinth_id" TEXT,
    "icon_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modpacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modpack_versions" (
    "id" TEXT NOT NULL,
    "modpack_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "recipe_hash" TEXT,
    "manifest_hash" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "synced_by_id" TEXT,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modpack_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "modpack_version_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source_mod" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "oauth_provider" "OAuthProvider" NOT NULL,
    "oauth_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flowcharts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "modpack_version_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flowcharts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "modpack_version_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "tooltip" TEXT[],
    "icon_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stars" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "flowchart_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "modpack_version_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "total_size" INTEGER NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "chunk_size" INTEGER NOT NULL,
    "final_hash" TEXT NOT NULL,
    "chunks_received" INTEGER[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modpacks_slug_key" ON "modpacks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "modpacks_curseforge_id_key" ON "modpacks"("curseforge_id");

-- CreateIndex
CREATE UNIQUE INDEX "modpacks_modrinth_id_key" ON "modpacks"("modrinth_id");

-- CreateIndex
CREATE INDEX "modpack_versions_modpack_id_idx" ON "modpack_versions"("modpack_id");

-- CreateIndex
CREATE INDEX "modpack_versions_is_verified_idx" ON "modpack_versions"("is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "modpack_versions_modpack_id_version_manifest_hash_key" ON "modpack_versions"("modpack_id", "version", "manifest_hash");

-- CreateIndex
CREATE INDEX "recipes_modpack_version_id_idx" ON "recipes"("modpack_version_id");

-- CreateIndex
CREATE INDEX "recipes_type_idx" ON "recipes"("type");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_modpack_version_id_recipe_id_key" ON "recipes"("modpack_version_id", "recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_oauth_provider_oauth_id_key" ON "users"("oauth_provider", "oauth_id");

-- CreateIndex
CREATE INDEX "flowcharts_user_id_idx" ON "flowcharts"("user_id");

-- CreateIndex
CREATE INDEX "flowcharts_modpack_version_id_idx" ON "flowcharts"("modpack_version_id");

-- CreateIndex
CREATE INDEX "flowcharts_is_public_idx" ON "flowcharts"("is_public");

-- CreateIndex
CREATE INDEX "items_modpack_version_id_idx" ON "items"("modpack_version_id");

-- CreateIndex
CREATE INDEX "items_display_name_idx" ON "items"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "items_modpack_version_id_item_id_key" ON "items"("modpack_version_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stars_user_id_flowchart_id_key" ON "stars"("user_id", "flowchart_id");

-- CreateIndex
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_modpack_id_fkey" FOREIGN KEY ("modpack_id") REFERENCES "modpacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_synced_by_id_fkey" FOREIGN KEY ("synced_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_modpack_version_id_fkey" FOREIGN KEY ("modpack_version_id") REFERENCES "modpack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flowcharts" ADD CONSTRAINT "flowcharts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flowcharts" ADD CONSTRAINT "flowcharts_modpack_version_id_fkey" FOREIGN KEY ("modpack_version_id") REFERENCES "modpack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_modpack_version_id_fkey" FOREIGN KEY ("modpack_version_id") REFERENCES "modpack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stars" ADD CONSTRAINT "stars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stars" ADD CONSTRAINT "stars_flowchart_id_fkey" FOREIGN KEY ("flowchart_id") REFERENCES "flowcharts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
