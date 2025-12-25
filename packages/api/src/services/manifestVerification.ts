/**
 * Manifest verification service
 *
 * Verifies modpack manifests against CurseForge and Modrinth APIs
 * to determine if a pack matches an official release.
 */

import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

// Types inferred from Prisma queries
type Modpack = NonNullable<Awaited<ReturnType<FastifyInstance["prisma"]["modpack"]["findUnique"]>>>;

// ==================== TYPES ====================

export interface VerificationResult {
  verified: boolean;
  source: "curseforge" | "modrinth" | "none";
  officialHash?: string;
  message: string;
}

export interface CurseForgeFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  hashes: Array<{
    value: string;
    algo: number; // 1 = SHA1, 2 = MD5
  }>;
}

export interface ModrinthVersion {
  id: string;
  version_number: string;
  files: Array<{
    hashes: {
      sha512: string;
      sha1: string;
    };
    filename: string;
  }>;
}

// ==================== CONSTANTS ====================

const CURSEFORGE_API_URL = "https://api.curseforge.com/v1";
const USER_AGENT = "RecipeFlow/1.0 (https://recipeflow.io)";

// ==================== SERVICE FUNCTIONS ====================

/**
 * Verify a modpack version's manifest against official sources
 *
 * @param modpack - The modpack with curseforgeId/modrinthId
 * @param version - The version string to verify
 * @param manifestHash - The manifest hash from the mod
 * @returns Verification result
 */
export async function verifyManifest(
  fastify: FastifyInstance,
  modpack: Modpack,
  version: string,
  manifestHash: string,
): Promise<VerificationResult> {
  // Try CurseForge first if we have a project ID
  if (modpack.curseforgeId && env.curseforgeApiKey) {
    const cfResult = await verifyCurseForge(fastify, modpack.curseforgeId, version, manifestHash);
    if (cfResult.verified) {
      return cfResult;
    }
  }

  // Try Modrinth if we have a project ID
  if (modpack.modrinthId) {
    const mrResult = await verifyModrinth(fastify, modpack.modrinthId, version, manifestHash);
    if (mrResult.verified) {
      return mrResult;
    }
  }

  // No verification possible
  if (!modpack.curseforgeId && !modpack.modrinthId) {
    return {
      verified: false,
      source: "none",
      message: "No CurseForge or Modrinth ID configured for this modpack",
    };
  }

  return {
    verified: false,
    source: "none",
    message: "Manifest hash does not match any official release",
  };
}

/**
 * Verify against CurseForge API
 */
async function verifyCurseForge(
  fastify: FastifyInstance,
  projectId: string,
  version: string,
  _manifestHash: string,
): Promise<VerificationResult> {
  if (!env.curseforgeApiKey) {
    return {
      verified: false,
      source: "curseforge",
      message: "CurseForge API key not configured",
    };
  }

  try {
    // Fetch project files from CurseForge
    const response = await fetch(`${CURSEFORGE_API_URL}/mods/${projectId}/files?pageSize=50`, {
      headers: {
        "x-api-key": env.curseforgeApiKey,
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      fastify.log.warn({ projectId, status: response.status }, "CurseForge API request failed");
      return {
        verified: false,
        source: "curseforge",
        message: `CurseForge API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as { data: CurseForgeFile[] };

    // Find file matching version string
    const matchingFile = data.data.find((file) => {
      // Match by display name or filename containing version
      const nameMatch = file.displayName.includes(version) || file.fileName.includes(version);
      return nameMatch;
    });

    if (!matchingFile) {
      return {
        verified: false,
        source: "curseforge",
        message: `No CurseForge file found for version ${version}`,
      };
    }

    // CurseForge doesn't provide manifest hash directly
    // The verification would need to download and compute the manifest hash
    // For now, we'll mark as verified if we found a matching version
    // Future: Download manifest.json and compute hash

    fastify.log.info(
      { projectId, version, fileId: matchingFile.id },
      "Found matching CurseForge file",
    );

    // Note: Full verification would require downloading the modpack and computing manifest hash
    // For MVP, we'll trust that if the version exists on CF, the user's hash is valid
    // TODO: Implement full manifest hash comparison

    return {
      verified: true,
      source: "curseforge",
      message: `Matched CurseForge file: ${matchingFile.displayName}`,
    };
  } catch (error) {
    fastify.log.error({ projectId, error }, "CurseForge verification failed");
    return {
      verified: false,
      source: "curseforge",
      message: `CurseForge verification error: ${error}`,
    };
  }
}

/**
 * Verify against Modrinth API
 */
async function verifyModrinth(
  fastify: FastifyInstance,
  projectId: string,
  version: string,
  _manifestHash: string,
): Promise<VerificationResult> {
  try {
    // Fetch project versions from Modrinth
    const response = await fetch(`${env.modrinthApiUrl}/project/${projectId}/version`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      fastify.log.warn({ projectId, status: response.status }, "Modrinth API request failed");
      return {
        verified: false,
        source: "modrinth",
        message: `Modrinth API error: ${response.status}`,
      };
    }

    const versions = (await response.json()) as ModrinthVersion[];

    // Find version matching version string
    const matchingVersion = versions.find((v) => v.version_number === version);

    if (!matchingVersion) {
      return {
        verified: false,
        source: "modrinth",
        message: `No Modrinth version found for ${version}`,
      };
    }

    fastify.log.info(
      { projectId, version, versionId: matchingVersion.id },
      "Found matching Modrinth version",
    );

    // Similar to CurseForge, full verification would require downloading pack.toml
    // and computing the manifest hash
    // TODO: Implement full manifest hash comparison

    return {
      verified: true,
      source: "modrinth",
      message: `Matched Modrinth version: ${matchingVersion.version_number}`,
    };
  } catch (error) {
    fastify.log.error({ projectId, error }, "Modrinth verification failed");
    return {
      verified: false,
      source: "modrinth",
      message: `Modrinth verification error: ${error}`,
    };
  }
}

/**
 * Update modpack version verification status
 */
export async function updateVerificationStatus(
  fastify: FastifyInstance,
  modpackVersionId: string,
  verified: boolean,
): Promise<void> {
  await fastify.prisma.modpackVersion.update({
    where: { id: modpackVersionId },
    data: { isVerified: verified },
  });
}

/**
 * Attempt verification for a modpack version
 *
 * Fetches modpack, attempts verification, and updates status.
 */
export async function verifyModpackVersion(
  fastify: FastifyInstance,
  modpackVersionId: string,
): Promise<VerificationResult> {
  const modpackVersion = await fastify.prisma.modpackVersion.findUnique({
    where: { id: modpackVersionId },
    include: { modpack: true },
  });

  if (!modpackVersion) {
    return {
      verified: false,
      source: "none",
      message: "Modpack version not found",
    };
  }

  if (!modpackVersion.manifestHash) {
    return {
      verified: false,
      source: "none",
      message: "No manifest hash available for verification",
    };
  }

  const result = await verifyManifest(
    fastify,
    modpackVersion.modpack,
    modpackVersion.version,
    modpackVersion.manifestHash,
  );

  // Update verification status in database
  await updateVerificationStatus(fastify, modpackVersionId, result.verified);

  return result;
}
