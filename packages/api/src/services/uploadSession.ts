/**
 * Upload session management service
 *
 * Handles chunked upload sessions including:
 * - Session creation with expiry
 * - Chunk storage with hash verification
 * - File reassembly and final hash verification
 * - Session cleanup for expired uploads
 */

import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import type { FastifyInstance } from "fastify";
import type { UploadType } from "@recipeflow/shared";
import { hashBuffer, hashesMatch, isValidHash } from "../utils/hash.js";
import { env } from "../config/env.js";

// Type for UploadSession from Prisma (inferred from query results)
type UploadSession = Awaited<
  ReturnType<FastifyInstance["prisma"]["uploadSession"]["findUnique"]>
> & {};

// ==================== CONSTANTS ====================

const SESSION_EXPIRY_HOURS = 1;
const SESSIONS_SUBDIR = "sessions";

// ==================== ERROR CLASSES ====================

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Upload session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionExpiredError extends Error {
  constructor(sessionId: string) {
    super(`Upload session has expired: ${sessionId}`);
    this.name = "SessionExpiredError";
  }
}

export class ChunkHashMismatchError extends Error {
  public readonly expected: string;
  public readonly received: string;

  constructor(expected: string, received: string) {
    super(`Chunk hash mismatch: expected ${expected}, received ${received}`);
    this.name = "ChunkHashMismatchError";
    this.expected = expected;
    this.received = received;
  }
}

export class ChunksMissingError extends Error {
  public readonly missing: number[];

  constructor(missing: number[]) {
    super(`Chunks missing: ${missing.join(", ")}`);
    this.name = "ChunksMissingError";
    this.missing = missing;
  }
}

export class FinalHashMismatchError extends Error {
  public readonly expected: string;
  public readonly received: string;

  constructor(expected: string, received: string) {
    super(`Final file hash mismatch: expected ${expected}, received ${received}`);
    this.name = "FinalHashMismatchError";
    this.expected = expected;
    this.received = received;
  }
}

// ==================== TYPES ====================

export interface CreateSessionParams {
  modpackVersionId: string;
  userId: string;
  type: UploadType;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  finalHash: string;
}

export interface StoreChunkResult {
  verified: boolean;
  session: UploadSession;
  chunksReceived: number;
  chunksRemaining: number;
}

export interface ReassembleResult {
  filePath: string;
  verified: boolean;
  hash: string;
}

// ==================== HELPER FUNCTIONS ====================

function getSessionDir(sessionId: string): string {
  return join(env.uploadDir, SESSIONS_SUBDIR, sessionId);
}

function getChunkPath(sessionId: string, chunkIndex: number): string {
  // Pad index to ensure proper sorting
  const paddedIndex = chunkIndex.toString().padStart(6, "0");
  return join(getSessionDir(sessionId), `chunk-${paddedIndex}`);
}

function getCompletePath(sessionId: string): string {
  return join(getSessionDir(sessionId), "complete");
}

// ==================== SERVICE FUNCTIONS ====================

/**
 * Create a new upload session
 */
export async function createUploadSession(
  fastify: FastifyInstance,
  params: CreateSessionParams,
): Promise<UploadSession> {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  // Validate hash format
  if (!isValidHash(params.finalHash)) {
    throw new Error(`Invalid hash format: ${params.finalHash}`);
  }

  const session = await fastify.prisma.uploadSession.create({
    data: {
      modpackVersionId: params.modpackVersionId,
      userId: params.userId,
      type: params.type,
      totalSize: params.totalSize,
      totalChunks: params.totalChunks,
      chunkSize: params.chunkSize,
      finalHash: params.finalHash,
      chunksReceived: [],
      expiresAt,
    },
  });

  // Create session directory for chunks
  const sessionDir = getSessionDir(session.id);
  await mkdir(sessionDir, { recursive: true });

  return session;
}

/**
 * Store a chunk and verify its hash
 */
export async function storeChunk(
  fastify: FastifyInstance,
  sessionId: string,
  chunkIndex: number,
  data: Buffer,
  expectedHash: string,
): Promise<StoreChunkResult> {
  // Get session first to verify it exists and hasn't expired
  const session = await fastify.prisma.uploadSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }

  if (session.expiresAt < new Date()) {
    throw new SessionExpiredError(sessionId);
  }

  // Verify chunk index is valid
  if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw new Error(`Invalid chunk index: ${chunkIndex} (expected 0-${session.totalChunks - 1})`);
  }

  // Verify chunk hash
  const actualHash = hashBuffer(data);
  if (!hashesMatch(actualHash, expectedHash)) {
    throw new ChunkHashMismatchError(expectedHash, actualHash);
  }

  // Write chunk to disk
  const chunkPath = getChunkPath(sessionId, chunkIndex);
  await writeFile(chunkPath, data);

  // Update session with received chunk (avoid duplicates)
  const currentChunks = new Set(session.chunksReceived);
  currentChunks.add(chunkIndex);
  const updatedChunks = Array.from(currentChunks).sort((a, b) => a - b);

  const updatedSession = await fastify.prisma.uploadSession.update({
    where: { id: sessionId },
    data: {
      chunksReceived: updatedChunks,
    },
  });

  return {
    verified: true,
    session: updatedSession,
    chunksReceived: updatedChunks.length,
    chunksRemaining: session.totalChunks - updatedChunks.length,
  };
}

/**
 * Get session status
 */
export async function getSessionStatus(
  fastify: FastifyInstance,
  sessionId: string,
): Promise<UploadSession | null> {
  return fastify.prisma.uploadSession.findUnique({
    where: { id: sessionId },
  });
}

/**
 * Get missing chunks for a session
 */
export function getMissingChunks(session: UploadSession): number[] {
  const receivedSet = new Set(session.chunksReceived);
  const missing: number[] = [];

  for (let i = 0; i < session.totalChunks; i++) {
    if (!receivedSet.has(i)) {
      missing.push(i);
    }
  }

  return missing;
}

/**
 * Reassemble chunks and verify final hash
 */
export async function reassembleAndVerify(
  fastify: FastifyInstance,
  sessionId: string,
): Promise<ReassembleResult> {
  const session = await fastify.prisma.uploadSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }

  // Check all chunks are present
  const missing = getMissingChunks(session);
  if (missing.length > 0) {
    throw new ChunksMissingError(missing);
  }

  // Read and concatenate all chunks in order
  const chunks: Buffer[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = getChunkPath(sessionId, i);
    const chunkData = await readFile(chunkPath);
    chunks.push(chunkData);
  }

  const completeData = Buffer.concat(chunks);
  const outputPath = getCompletePath(sessionId);
  await writeFile(outputPath, completeData);

  // Verify final hash
  const actualHash = hashBuffer(completeData);
  const verified = hashesMatch(actualHash, session.finalHash);

  if (!verified) {
    throw new FinalHashMismatchError(session.finalHash, actualHash);
  }

  // Mark session as complete
  await fastify.prisma.uploadSession.update({
    where: { id: sessionId },
    data: { completedAt: new Date() },
  });

  return {
    filePath: outputPath,
    verified: true,
    hash: actualHash,
  };
}

/**
 * Get the reassembled file path (must call reassembleAndVerify first)
 */
export function getCompletedFilePath(sessionId: string): string {
  return getCompletePath(sessionId);
}

/**
 * Clean up session files (call after processing is complete)
 */
export async function cleanupSessionFiles(sessionId: string): Promise<void> {
  const sessionDir = getSessionDir(sessionId);
  await rm(sessionDir, { recursive: true, force: true });
}

/**
 * Clean up expired sessions and their files
 */
export async function cleanupExpiredSessions(fastify: FastifyInstance): Promise<number> {
  // Find expired, incomplete sessions
  const expiredSessions = await fastify.prisma.uploadSession.findMany({
    where: {
      expiresAt: { lt: new Date() },
      completedAt: null,
    },
    select: { id: true },
  });

  // Clean up files for each expired session
  for (const session of expiredSessions) {
    try {
      await cleanupSessionFiles(session.id);
    } catch (error) {
      // Log but don't fail - files might already be gone
      fastify.log.warn({ sessionId: session.id, error }, "Failed to cleanup session files");
    }
  }

  // Delete expired sessions from database
  const result = await fastify.prisma.uploadSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      completedAt: null,
    },
  });

  return result.count;
}

/**
 * Clean up old completed sessions (older than 24 hours)
 */
export async function cleanupCompletedSessions(fastify: FastifyInstance): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const oldSessions = await fastify.prisma.uploadSession.findMany({
    where: {
      completedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  for (const session of oldSessions) {
    try {
      await cleanupSessionFiles(session.id);
    } catch {
      // Ignore - files might already be gone
    }
  }

  const result = await fastify.prisma.uploadSession.deleteMany({
    where: {
      completedAt: { lt: cutoff },
    },
  });

  return result.count;
}
