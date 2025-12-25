/**
 * Recipe sync routes
 *
 * Handles recipe synchronization from the companion mod.
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { syncRecipes } from "../services/recipeImport.js";
import { verifyModpackVersion } from "../services/manifestVerification.js";
import type { RecipeSyncRequest, RecipeSyncResponse } from "@recipeflow/shared";
import { isValidHash } from "../utils/hash.js";

// ==================== TYPES ====================

interface RecipeSyncParams {
  slug: string;
  version: string;
}

// ==================== ROUTES ====================

const recipeRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Sync recipes for a modpack version
   *
   * POST /modpacks/:slug/versions/:version/recipes/sync
   *
   * Receives recipe data from the companion mod and stores it in the database.
   * Creates the modpack and version if they don't exist.
   */
  fastify.post<{
    Params: RecipeSyncParams;
    Body: RecipeSyncRequest;
  }>(
    "/:slug/versions/:version/recipes/sync",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      // Increase body limit for recipe payloads (50MB)
      bodyLimit: 50 * 1024 * 1024,
    },
    async (request, reply) => {
      const { slug, version } = request.params;
      const userId = request.authenticatedUser!.id;
      const body = request.body;

      // Validate request body
      if (!body.contentHash || !isValidHash(body.contentHash)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CONTENT_HASH",
            message: "Missing or invalid contentHash (expected sha256:...)",
          },
        });
      }

      if (!body.manifestHash || !isValidHash(body.manifestHash)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_MANIFEST_HASH",
            message: "Missing or invalid manifestHash (expected sha256:...)",
          },
        });
      }

      if (!Array.isArray(body.recipes)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_RECIPES",
            message: "Missing or invalid recipes array",
          },
        });
      }

      if (typeof body.recipeCount !== "number" || body.recipeCount < 0) {
        return reply.status(400).send({
          error: {
            code: "INVALID_RECIPE_COUNT",
            message: "Missing or invalid recipeCount",
          },
        });
      }

      // Validate each recipe has required fields
      for (const [i, recipe] of body.recipes.entries()) {
        if (!recipe || !recipe.recipeId || typeof recipe.recipeId !== "string") {
          return reply.status(400).send({
            error: {
              code: "INVALID_RECIPE",
              message: `Recipe at index ${i} missing or invalid recipeId`,
            },
          });
        }
        if (!recipe.type || typeof recipe.type !== "string") {
          return reply.status(400).send({
            error: {
              code: "INVALID_RECIPE",
              message: `Recipe at index ${i} missing or invalid type`,
            },
          });
        }
        if (!recipe.sourceMod || typeof recipe.sourceMod !== "string") {
          return reply.status(400).send({
            error: {
              code: "INVALID_RECIPE",
              message: `Recipe at index ${i} missing or invalid sourceMod`,
            },
          });
        }
        if (!recipe.data || typeof recipe.data !== "object") {
          return reply.status(400).send({
            error: {
              code: "INVALID_RECIPE",
              message: `Recipe at index ${i} missing or invalid data`,
            },
          });
        }
      }

      try {
        const result = await syncRecipes(fastify, slug, version, userId, body);

        // Attempt manifest verification in the background
        // Don't block the response on this
        verifyModpackVersion(fastify, result.modpackVersionId).catch((error) => {
          fastify.log.warn(
            { error, versionId: result.modpackVersionId },
            "Manifest verification failed",
          );
        });

        const response: RecipeSyncResponse = {
          success: true,
          stats: {
            received: result.received,
            new: result.new,
            updated: result.updated,
            unchanged: result.unchanged,
          },
          contentHash: result.contentHash,
          version: result.version,
        };

        return response;
      } catch (error) {
        request.log.error(error, "Recipe sync failed");

        return reply.status(500).send({
          error: {
            code: "SYNC_FAILED",
            message: "Failed to sync recipes",
          },
        });
      }
    },
  );
};

export default recipeRoutes;
