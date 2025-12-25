/**
 * Modpack routes aggregator
 *
 * Registers all routes under the /modpacks prefix.
 */

import type { FastifyPluginAsync } from "fastify";
import recipeRoutes from "../recipes.js";
import uploadRoutes from "../upload.js";

const modpackRoutes: FastifyPluginAsync = async (fastify) => {
  // Recipe sync routes
  // POST /modpacks/:slug/versions/:version/recipes/sync
  await fastify.register(recipeRoutes);

  // Chunked upload routes
  // POST /modpacks/:slug/versions/:version/upload/start
  // POST /modpacks/:slug/versions/:version/upload/:sessionId/chunk/:chunkIndex
  // GET  /modpacks/:slug/versions/:version/upload/:sessionId/status
  // POST /modpacks/:slug/versions/:version/upload/:sessionId/complete
  await fastify.register(uploadRoutes);
};

export default modpackRoutes;
