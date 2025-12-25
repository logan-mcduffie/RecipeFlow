/**
 * SHA-256 hash utilities for data verification
 */

import { createHash } from "crypto";
import { createReadStream } from "fs";

/**
 * Compute SHA-256 hash of a buffer
 * @param buffer - The buffer to hash
 * @returns Hash string in format "sha256:hexdigest"
 */
export function hashBuffer(buffer: Buffer): string {
  const hash = createHash("sha256").update(buffer).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Compute SHA-256 hash of a file
 * @param filePath - Path to the file to hash
 * @returns Promise resolving to hash string in format "sha256:hexdigest"
 */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(`sha256:${hash.digest("hex")}`));
    stream.on("error", reject);
  });
}

/**
 * Verify a hash string matches the expected format
 * @param hash - The hash string to validate
 * @returns true if format is valid (sha256:64hexchars)
 */
export function isValidHash(hash: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(hash);
}

/**
 * Compare two hashes using constant-time comparison to prevent timing attacks
 * @param a - First hash string
 * @param b - Second hash string
 * @returns true if hashes match
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Strip the "sha256:" prefix from a hash if present
 * @param hash - Hash string with or without prefix
 * @returns The hex digest portion only
 */
export function stripHashPrefix(hash: string): string {
  if (hash.startsWith("sha256:")) {
    return hash.slice(7);
  }
  return hash;
}
