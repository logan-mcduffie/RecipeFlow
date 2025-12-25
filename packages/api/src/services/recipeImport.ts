/**
 * Recipe import service
 *
 * Handles recipe synchronization from the companion mod including:
 * - Modpack and version creation/update
 * - Recipe upsert with change detection
 * - Import statistics tracking
 */

import type { FastifyInstance } from "fastify";
import type { RecipeSyncRequest, RecipeSyncInput } from "@recipeflow/shared";
import { hashesMatch } from "../utils/hash.js";

// Types inferred from Prisma queries
type ModpackVersion = NonNullable<
  Awaited<ReturnType<FastifyInstance["prisma"]["modpackVersion"]["findUnique"]>>
>;
type Recipe = NonNullable<Awaited<ReturnType<FastifyInstance["prisma"]["recipe"]["findUnique"]>>>;

// ==================== TYPES ====================

export interface RecipeSyncResult {
  received: number;
  new: number;
  updated: number;
  unchanged: number;
  contentHash: string;
  version: string;
  modpackVersionId: string;
  isVerified: boolean;
}

export interface UpsertStats {
  new: number;
  updated: number;
  unchanged: number;
}

// ==================== SERVICE FUNCTIONS ====================

/**
 * Sync recipes for a modpack version
 *
 * This is the main entry point for recipe synchronization.
 * It handles modpack/version creation and recipe upserts.
 */
export async function syncRecipes(
  fastify: FastifyInstance,
  modpackSlug: string,
  version: string,
  userId: string,
  payload: RecipeSyncRequest,
): Promise<RecipeSyncResult> {
  const { contentHash, manifestHash, recipeCount, recipes } = payload;

  // 1. Find or create modpack
  let modpack = await fastify.prisma.modpack.findUnique({
    where: { slug: modpackSlug },
  });

  if (!modpack) {
    modpack = await fastify.prisma.modpack.create({
      data: {
        slug: modpackSlug,
        name: formatModpackName(modpackSlug),
      },
    });
    fastify.log.info({ slug: modpackSlug }, "Created new modpack");
  }

  // 2. Find or create modpack version
  const { modpackVersion } = await findOrCreateModpackVersion(
    fastify,
    modpack.id,
    version,
    manifestHash,
    userId,
  );

  // 3. Check if content has changed (skip if no recipes to sync)
  if (modpackVersion.recipeHash && hashesMatch(modpackVersion.recipeHash, contentHash)) {
    fastify.log.info(
      { versionId: modpackVersion.id, hash: contentHash },
      "Content hash unchanged, skipping recipe sync",
    );

    return {
      received: recipeCount,
      new: 0,
      updated: 0,
      unchanged: recipeCount,
      contentHash,
      version,
      modpackVersionId: modpackVersion.id,
      isVerified: modpackVersion.isVerified,
    };
  }

  // 4. Upsert recipes
  const stats = await upsertRecipes(fastify, modpackVersion.id, recipes);

  // 5. Update version with new hash and sync info
  const updatedVersion = await fastify.prisma.modpackVersion.update({
    where: { id: modpackVersion.id },
    data: {
      recipeHash: contentHash,
      syncedById: userId,
      syncedAt: new Date(),
    },
  });

  fastify.log.info(
    {
      versionId: modpackVersion.id,
      stats,
      contentHash,
    },
    "Recipe sync completed",
  );

  return {
    received: recipeCount,
    ...stats,
    contentHash,
    version,
    modpackVersionId: modpackVersion.id,
    isVerified: updatedVersion.isVerified,
  };
}

/**
 * Find or create a modpack version
 *
 * Versions are unique by (modpackId, version, manifestHash) to support
 * both official and modified versions of the same modpack version.
 */
async function findOrCreateModpackVersion(
  fastify: FastifyInstance,
  modpackId: string,
  version: string,
  manifestHash: string,
  userId: string,
): Promise<{ modpackVersion: ModpackVersion; isNew: boolean }> {
  // Try to find existing version with same manifest
  let modpackVersion = await fastify.prisma.modpackVersion.findUnique({
    where: {
      modpackId_version_manifestHash: {
        modpackId,
        version,
        manifestHash,
      },
    },
  });

  if (modpackVersion) {
    return { modpackVersion, isNew: false };
  }

  // Create new version
  modpackVersion = await fastify.prisma.modpackVersion.create({
    data: {
      modpackId,
      version,
      manifestHash,
      isVerified: false, // Will be verified by manifestVerification service if applicable
      syncedById: userId,
      syncedAt: new Date(),
    },
  });

  fastify.log.info({ modpackId, version, manifestHash }, "Created new modpack version");

  return { modpackVersion, isNew: true };
}

/**
 * Upsert recipes with change detection
 *
 * Compares incoming recipes with existing ones to track
 * new, updated, and unchanged counts.
 */
async function upsertRecipes(
  fastify: FastifyInstance,
  modpackVersionId: string,
  recipes: RecipeSyncInput[],
): Promise<UpsertStats> {
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  // Process in batches for performance
  const BATCH_SIZE = 100;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);

    // Fetch existing recipes for this batch
    const recipeIds = batch.map((r) => r.recipeId);
    const existingRecipes = await fastify.prisma.recipe.findMany({
      where: {
        modpackVersionId,
        recipeId: { in: recipeIds },
      },
    });

    const existingMap = new Map(existingRecipes.map((r) => [r.recipeId, r]));

    // Process each recipe in the batch
    for (const recipe of batch) {
      const existing = existingMap.get(recipe.recipeId);

      if (!existing) {
        // New recipe - create it
        await fastify.prisma.recipe.create({
          data: {
            modpackVersionId,
            recipeId: recipe.recipeId,
            type: recipe.type,
            sourceMod: recipe.sourceMod,
            data: recipe.data as object,
          },
        });
        newCount++;
      } else {
        // Existing recipe - check for changes
        const hasChanges = hasRecipeChanged(existing, recipe);

        if (hasChanges) {
          await fastify.prisma.recipe.update({
            where: { id: existing.id },
            data: {
              type: recipe.type,
              sourceMod: recipe.sourceMod,
              data: recipe.data as object,
            },
          });
          updatedCount++;
        } else {
          unchangedCount++;
        }
      }
    }
  }

  return { new: newCount, updated: updatedCount, unchanged: unchangedCount };
}

/**
 * Check if a recipe has changed compared to existing data
 */
function hasRecipeChanged(existing: Recipe, incoming: RecipeSyncInput): boolean {
  // Check simple fields first
  if (existing.type !== incoming.type) return true;
  if (existing.sourceMod !== incoming.sourceMod) return true;

  // Compare JSON data
  const existingData = JSON.stringify(existing.data);
  const incomingData = JSON.stringify(incoming.data);

  return existingData !== incomingData;
}

/**
 * Format a modpack slug into a display name
 * Example: "gtnh-modern" -> "Gtnh Modern"
 */
function formatModpackName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get recipe count for a modpack version
 */
export async function getRecipeCount(
  fastify: FastifyInstance,
  modpackVersionId: string,
): Promise<number> {
  return fastify.prisma.recipe.count({
    where: { modpackVersionId },
  });
}

/**
 * Delete all recipes for a modpack version
 * (Useful for full re-sync)
 */
export async function deleteAllRecipes(
  fastify: FastifyInstance,
  modpackVersionId: string,
): Promise<number> {
  const result = await fastify.prisma.recipe.deleteMany({
    where: { modpackVersionId },
  });

  return result.count;
}
