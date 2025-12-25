/**
 * Chunked upload session types
 */

export type UploadType = "icons" | "items";

/** Request to start a chunked upload session */
export interface UploadStartRequest {
  type: UploadType;
  totalSize: number; // Total bytes
  totalChunks: number; // Number of chunks
  chunkSize: number; // Size per chunk (except possibly last)
  finalHash: string; // Expected SHA-256 of reassembled file (sha256:...)
}

/** Response from starting an upload session */
export interface UploadStartResponse {
  sessionId: string;
  expiresAt: string; // ISO 8601 timestamp
}

/** Response from uploading a chunk */
export interface ChunkUploadResponse {
  chunkIndex: number;
  verified: boolean;
  chunksReceived: number;
  chunksRemaining: number;
}

/** Error response for chunk hash mismatch */
export interface ChunkHashMismatchError {
  error: "HASH_MISMATCH";
  expected: string;
  received: string;
  retryable: boolean;
}

/** Response from checking upload status */
export interface UploadStatusResponse {
  sessionId: string;
  type: UploadType;
  chunksReceived: number[];
  chunksMissing: number[];
  totalChunks: number;
  expiresAt: string;
}

/** Response from completing an upload (success) */
export interface UploadCompleteSuccessResponse {
  success: true;
  finalHashVerified: true;
  itemsProcessed?: number;
  iconsProcessed?: number;
}

/** Response from completing an upload (failure) */
export interface UploadCompleteFailureResponse {
  success: false;
  error: string;
  finalHashVerified?: boolean;
  chunksMissing?: number[];
}

/** Union type for upload complete responses */
export type UploadCompleteResponse = UploadCompleteSuccessResponse | UploadCompleteFailureResponse;

/** Recipe sync request payload */
export interface RecipeSyncRequest {
  contentHash: string; // SHA-256 hash of all recipes
  manifestHash: string; // SHA-256 hash of mod list
  recipeCount: number;
  recipes: RecipeSyncInput[];
}

/** Single recipe in sync request */
export interface RecipeSyncInput {
  recipeId: string; // Unique recipe identifier
  type: string; // Recipe type (e.g., "minecraft:crafting_shaped")
  sourceMod: string; // Mod providing this recipe
  data: Record<string, unknown>; // JSONB recipe data
}

/** Recipe sync response */
export interface RecipeSyncResponse {
  success: boolean;
  stats: {
    received: number;
    new: number;
    updated: number;
    unchanged: number;
  };
  contentHash: string;
  version: string;
}
