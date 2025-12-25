/**
 * Cleanup scheduler for expired upload sessions
 *
 * Runs periodically to clean up expired and old completed sessions.
 */

import type { FastifyInstance } from "fastify";
import { cleanupExpiredSessions, cleanupCompletedSessions } from "../services/uploadSession.js";

// Run cleanup every 15 minutes
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the periodic cleanup scheduler
 */
export function startCleanupScheduler(fastify: FastifyInstance): void {
  if (cleanupInterval) {
    fastify.log.warn("Cleanup scheduler already running");
    return;
  }

  // Run cleanup immediately on startup
  runCleanup(fastify);

  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    runCleanup(fastify);
  }, CLEANUP_INTERVAL_MS);

  fastify.log.info({ intervalMs: CLEANUP_INTERVAL_MS }, "Upload session cleanup scheduler started");
}

/**
 * Stop the cleanup scheduler
 */
export function stopCleanupScheduler(fastify: FastifyInstance): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    fastify.log.info("Upload session cleanup scheduler stopped");
  }
}

/**
 * Run cleanup for both expired and old completed sessions
 */
async function runCleanup(fastify: FastifyInstance): Promise<void> {
  try {
    const expiredCount = await cleanupExpiredSessions(fastify);
    const completedCount = await cleanupCompletedSessions(fastify);

    if (expiredCount > 0 || completedCount > 0) {
      fastify.log.info({ expiredCount, completedCount }, "Upload session cleanup completed");
    }
  } catch (error) {
    fastify.log.error(error, "Upload session cleanup failed");
  }
}

/**
 * Manually trigger cleanup (useful for testing)
 */
export async function triggerCleanup(fastify: FastifyInstance): Promise<{
  expired: number;
  completed: number;
}> {
  const expired = await cleanupExpiredSessions(fastify);
  const completed = await cleanupCompletedSessions(fastify);

  return { expired, completed };
}
