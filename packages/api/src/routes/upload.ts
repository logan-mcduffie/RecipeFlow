/**
 * Chunked upload routes
 *
 * Handles large file uploads (icons, item metadata) via a chunked protocol.
 * Supports resumable uploads with hash verification.
 */

import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import {
  createUploadSession,
  storeChunk,
  getSessionStatus,
  getMissingChunks,
  reassembleAndVerify,
  cleanupSessionFiles,
  SessionExpiredError,
  ChunkHashMismatchError,
  ChunksMissingError,
  FinalHashMismatchError,
} from "../services/uploadSession.js";
import { iconStorage } from "../services/iconStorage.js";
import { parseItemsFile, importItems, linkIconsToItems } from "../services/itemImport.js";
import type {
  UploadStartRequest,
  UploadStartResponse,
  ChunkUploadResponse,
  UploadStatusResponse,
  UploadCompleteResponse,
} from "@recipeflow/shared";
import { isValidHash } from "../utils/hash.js";

// ==================== TYPES ====================

interface UploadParams {
  slug: string;
  version: string;
}

interface ChunkParams extends UploadParams {
  sessionId: string;
  chunkIndex: string;
}

interface SessionParams extends UploadParams {
  sessionId: string;
}

// ==================== ROUTES ====================

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Start a chunked upload session
   *
   * POST /modpacks/:slug/versions/:version/upload/start
   */
  fastify.post<{
    Params: UploadParams;
    Body: UploadStartRequest;
  }>(
    "/:slug/versions/:version/upload/start",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { slug, version } = request.params;
      const { type, totalSize, totalChunks, chunkSize, finalHash } = request.body;
      const userId = request.authenticatedUser!.id;

      // Validate type
      if (!["icons", "items"].includes(type)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_TYPE",
            message: "Type must be 'icons' or 'items'",
          },
        });
      }

      // Validate hash
      if (!finalHash || !isValidHash(finalHash)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_HASH",
            message: "Missing or invalid finalHash (expected sha256:...)",
          },
        });
      }

      // Validate numeric fields
      if (typeof totalSize !== "number" || totalSize <= 0) {
        return reply.status(400).send({
          error: {
            code: "INVALID_SIZE",
            message: "totalSize must be a positive number",
          },
        });
      }

      if (typeof totalChunks !== "number" || totalChunks <= 0) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHUNKS",
            message: "totalChunks must be a positive number",
          },
        });
      }

      if (typeof chunkSize !== "number" || chunkSize <= 0) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHUNK_SIZE",
            message: "chunkSize must be a positive number",
          },
        });
      }

      // Find modpack and version
      const modpack = await fastify.prisma.modpack.findUnique({
        where: { slug },
      });

      if (!modpack) {
        return reply.status(404).send({
          error: {
            code: "MODPACK_NOT_FOUND",
            message: `Modpack '${slug}' not found`,
          },
        });
      }

      // Find version (must have been created via recipe sync first)
      const modpackVersion = await fastify.prisma.modpackVersion.findFirst({
        where: {
          modpackId: modpack.id,
          version,
        },
      });

      if (!modpackVersion) {
        return reply.status(404).send({
          error: {
            code: "VERSION_NOT_FOUND",
            message: `Version '${version}' not found. Sync recipes first.`,
          },
        });
      }

      try {
        const session = await createUploadSession(fastify, {
          modpackVersionId: modpackVersion.id,
          userId,
          type,
          totalSize,
          totalChunks,
          chunkSize,
          finalHash,
        });

        const response: UploadStartResponse = {
          sessionId: session.id,
          expiresAt: session.expiresAt.toISOString(),
        };

        return response;
      } catch (error) {
        request.log.error(error, "Failed to create upload session");
        return reply.status(500).send({
          error: {
            code: "SESSION_CREATE_FAILED",
            message: "Failed to create upload session",
          },
        });
      }
    },
  );

  /**
   * Upload a chunk
   *
   * POST /modpacks/:slug/versions/:version/upload/:sessionId/chunk/:chunkIndex
   */
  fastify.post<{
    Params: ChunkParams;
  }>(
    "/:slug/versions/:version/upload/:sessionId/chunk/:chunkIndex",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 100,
          timeWindow: "1 minute",
        },
      },
      // 10MB per chunk max
      bodyLimit: 10 * 1024 * 1024,
    },
    async (request, reply) => {
      const { sessionId, chunkIndex: chunkIndexStr } = request.params;
      const chunkIndex = parseInt(chunkIndexStr, 10);
      const expectedHash = request.headers["x-chunk-hash"] as string | undefined;

      // Validate chunk index
      if (isNaN(chunkIndex) || chunkIndex < 0) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHUNK_INDEX",
            message: "chunkIndex must be a non-negative integer",
          },
        });
      }

      // Validate hash header
      if (!expectedHash || !isValidHash(expectedHash)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_CHUNK_HASH",
            message: "Missing or invalid X-Chunk-Hash header (expected sha256:...)",
          },
        });
      }

      // Verify session exists and user owns it
      const session = await getSessionStatus(fastify, sessionId);
      if (!session) {
        return reply.status(404).send({
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Upload session not found",
          },
        });
      }

      if (session.userId !== request.authenticatedUser!.id) {
        return reply.status(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Not authorized for this upload session",
          },
        });
      }

      if (session.expiresAt < new Date()) {
        return reply.status(410).send({
          error: {
            code: "SESSION_EXPIRED",
            message: "Upload session has expired",
          },
        });
      }

      // Get raw body as Buffer
      // Fastify stores raw body when content-type is application/octet-stream
      const data = request.body as Buffer;

      if (!Buffer.isBuffer(data) || data.length === 0) {
        return reply.status(400).send({
          error: {
            code: "INVALID_BODY",
            message: "Request body must be binary data",
          },
        });
      }

      try {
        const result = await storeChunk(fastify, sessionId, chunkIndex, data, expectedHash);

        const response: ChunkUploadResponse = {
          chunkIndex,
          verified: result.verified,
          chunksReceived: result.chunksReceived,
          chunksRemaining: result.chunksRemaining,
        };

        return response;
      } catch (error) {
        if (error instanceof ChunkHashMismatchError) {
          return reply.status(400).send({
            error: "HASH_MISMATCH",
            expected: error.expected,
            received: error.received,
            retryable: true,
          });
        }
        if (error instanceof SessionExpiredError) {
          return reply.status(410).send({
            error: {
              code: "SESSION_EXPIRED",
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );

  /**
   * Check upload status
   *
   * GET /modpacks/:slug/versions/:version/upload/:sessionId/status
   */
  fastify.get<{
    Params: SessionParams;
  }>(
    "/:slug/versions/:version/upload/:sessionId/status",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      const session = await getSessionStatus(fastify, sessionId);
      if (!session) {
        return reply.status(404).send({
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Upload session not found",
          },
        });
      }

      // Allow checking status even if not owner (for debugging)
      // but don't expose sensitive data

      const chunksMissing = getMissingChunks(session);

      const response: UploadStatusResponse = {
        sessionId: session.id,
        type: session.type as "icons" | "items",
        chunksReceived: session.chunksReceived,
        chunksMissing,
        totalChunks: session.totalChunks,
        expiresAt: session.expiresAt.toISOString(),
      };

      return response;
    },
  );

  /**
   * Complete upload and process the file
   *
   * POST /modpacks/:slug/versions/:version/upload/:sessionId/complete
   */
  fastify.post<{
    Params: SessionParams;
  }>(
    "/:slug/versions/:version/upload/:sessionId/complete",
    {
      preHandler: requireAuth,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { slug, version, sessionId } = request.params;

      const session = await getSessionStatus(fastify, sessionId);
      if (!session) {
        return reply.status(404).send({
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Upload session not found",
          },
        });
      }

      if (session.userId !== request.authenticatedUser!.id) {
        return reply.status(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Not authorized for this upload session",
          },
        });
      }

      try {
        // Reassemble and verify final hash
        const { filePath, verified } = await reassembleAndVerify(fastify, sessionId);

        if (!verified) {
          const response: UploadCompleteResponse = {
            success: false,
            finalHashVerified: false,
            error: "FINAL_HASH_MISMATCH",
          };
          return reply.status(400).send(response);
        }

        // Process based on type
        if (session.type === "icons") {
          // Extract and store icons
          const result = await iconStorage.extractAndStoreIcons(slug, version, filePath);

          // Link icons to items
          const iconLinks = result.icons.map((icon) => ({
            itemId: icon.itemId,
            filename: icon.filename,
          }));
          await linkIconsToItems(fastify, session.modpackVersionId, iconLinks);

          // Cleanup session files
          await cleanupSessionFiles(sessionId);

          if (result.errors.length > 0) {
            request.log.warn({ errors: result.errors }, "Some icons failed to process");
          }

          const response: UploadCompleteResponse = {
            success: true,
            finalHashVerified: true,
            iconsProcessed: result.icons.length,
          };

          return response;
        } else if (session.type === "items") {
          // Parse and import items
          const itemsData = await parseItemsFile(filePath);
          const result = await importItems(fastify, session.modpackVersionId, itemsData);

          // Cleanup session files
          await cleanupSessionFiles(sessionId);

          const response: UploadCompleteResponse = {
            success: true,
            finalHashVerified: true,
            itemsProcessed: result.total,
          };

          return response;
        }

        // Unknown type (shouldn't happen)
        return reply.status(400).send({
          success: false,
          error: "UNKNOWN_TYPE",
        });
      } catch (error) {
        if (error instanceof ChunksMissingError) {
          const response: UploadCompleteResponse = {
            success: false,
            error: "CHUNKS_MISSING",
            chunksMissing: error.missing,
          };
          return reply.status(400).send(response);
        }
        if (error instanceof FinalHashMismatchError) {
          const response: UploadCompleteResponse = {
            success: false,
            error: "FINAL_HASH_MISMATCH",
            finalHashVerified: false,
          };
          return reply.status(400).send(response);
        }

        request.log.error(error, "Upload complete failed");
        return reply.status(500).send({
          success: false,
          error: "PROCESSING_FAILED",
        });
      }
    },
  );
};

export default uploadRoutes;
