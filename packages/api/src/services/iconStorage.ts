/**
 * Icon storage service with pluggable backend abstraction
 *
 * Starts with local filesystem storage, designed to easily
 * swap to cloud storage (S3, R2, etc.) later.
 */

import { mkdir, writeFile, rm, stat } from "fs/promises";
import { join, basename, extname } from "path";
import { env } from "../config/env.js";
import type { IconMetadataPayload } from "@recipeflow/shared";

// ==================== STORAGE BACKEND INTERFACE ====================

/**
 * Abstract storage backend interface.
 * Implement this to add S3, R2, or other cloud storage.
 */
export interface StorageBackend {
  /**
   * Store a file
   * @param key - Storage key (e.g., "gtnh-modern/2.7.1/minecraft_iron_ingot.png")
   * @param data - File data as Buffer
   * @returns Public URL to access the file
   */
  store(key: string, data: Buffer): Promise<string>;

  /**
   * Delete a file
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all files under a prefix
   * @param prefix - Key prefix (e.g., "gtnh-modern/2.7.1/")
   */
  deletePrefix(prefix: string): Promise<void>;

  /**
   * Get public URL for a key
   * @param key - Storage key
   * @returns Public URL
   */
  getUrl(key: string): string;

  /**
   * Check if a file exists
   * @param key - Storage key
   */
  exists(key: string): Promise<boolean>;
}

// ==================== LOCAL FILESYSTEM BACKEND ====================

/**
 * Local filesystem storage backend.
 * Stores files in the configured ICON_DIR directory.
 */
export class LocalStorageBackend implements StorageBackend {
  private readonly rootDir: string;
  private readonly baseUrl: string;

  constructor(rootDir: string = env.iconDir, baseUrl: string = env.iconBaseUrl) {
    this.rootDir = rootDir;
    this.baseUrl = baseUrl;
  }

  async store(key: string, data: Buffer): Promise<string> {
    const filePath = this.keyToPath(key);
    const dir = join(filePath, "..");

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, data);

    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.keyToPath(key);
    await rm(filePath, { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    const dirPath = this.keyToPath(prefix);
    await rm(dirPath, { recursive: true, force: true });
  }

  getUrl(key: string): string {
    // Returns relative URL like /icons/gtnh-modern/2.7.1/minecraft_iron_ingot.png
    return `${this.baseUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.keyToPath(key);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private keyToPath(key: string): string {
    return join(this.rootDir, key);
  }
}

// ==================== ICON STORAGE SERVICE ====================

export interface StoredIcon {
  filename: string; // e.g., "minecraft_iron_ingot.png"
  itemId: string; // Derived: "minecraft:iron_ingot"
  url: string; // Public URL
  animated: boolean;
  frameCount: number;
  frameTimeMs: number;
}

export interface ExtractResult {
  icons: StoredIcon[];
  errors: string[];
}

/**
 * Icon storage service - handles icon extraction, storage, and URL generation
 */
export class IconStorageService {
  constructor(private readonly backend: StorageBackend = new LocalStorageBackend()) {}

  /**
   * Extract icons from a ZIP archive and store them
   * @param modpackSlug - Modpack slug (e.g., "gtnh-modern")
   * @param version - Version string (e.g., "2.7.1")
   * @param zipPath - Path to the uploaded ZIP file
   * @returns List of stored icons with their URLs
   */
  async extractAndStoreIcons(
    modpackSlug: string,
    version: string,
    zipPath: string,
  ): Promise<ExtractResult> {
    // Dynamic import to avoid loading adm-zip unless needed
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const storedIcons: StoredIcon[] = [];
    const errors: string[] = [];

    // Look for icon-metadata.json first
    let iconMetadata: IconMetadataPayload = {};
    const metadataEntry = entries.find((e) => e.entryName === "icon-metadata.json");
    if (metadataEntry) {
      try {
        iconMetadata = JSON.parse(metadataEntry.getData().toString("utf-8"));
      } catch (e) {
        errors.push(`Failed to parse icon-metadata.json: ${e}`);
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const filename = basename(entry.entryName);
      if (!this.isIconFile(filename)) continue;

      try {
        const data = entry.getData();
        const key = this.buildKey(modpackSlug, version, filename);
        const url = await this.backend.store(key, data);

        const itemId = this.filenameToItemId(filename);
        const metadata = iconMetadata[itemId] ?? {
          animated: false,
          frameCount: 1,
          frameTimeMs: 0,
        };

        storedIcons.push({
          filename,
          itemId,
          url,
          animated: metadata.animated,
          frameCount: metadata.frameCount,
          frameTimeMs: metadata.frameTimeMs,
        });
      } catch (e) {
        errors.push(`Failed to store ${filename}: ${e}`);
      }
    }

    return { icons: storedIcons, errors };
  }

  /**
   * Delete all icons for a modpack version
   */
  async deleteVersionIcons(modpackSlug: string, version: string): Promise<void> {
    const prefix = `${modpackSlug}/${version}/`;
    await this.backend.deletePrefix(prefix);
  }

  /**
   * Get the public URL for an icon
   */
  getIconUrl(modpackSlug: string, version: string, filename: string): string {
    const key = this.buildKey(modpackSlug, version, filename);
    return this.backend.getUrl(key);
  }

  /**
   * Convert filename to itemId
   * Example: "gtceu_sodium_hydroxide_dust.png" -> "gtceu:sodium_hydroxide_dust"
   */
  private filenameToItemId(filename: string): string {
    const name = basename(filename, extname(filename));
    const firstUnderscore = name.indexOf("_");
    if (firstUnderscore === -1) return name;

    const namespace = name.substring(0, firstUnderscore);
    const path = name.substring(firstUnderscore + 1);
    return `${namespace}:${path}`;
  }

  /**
   * Build storage key from modpack, version, and filename
   */
  private buildKey(modpackSlug: string, version: string, filename: string): string {
    return `${modpackSlug}/${version}/${filename}`;
  }

  /**
   * Check if a file is a supported icon format
   */
  private isIconFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return [".png", ".webp", ".apng", ".gif"].includes(ext);
  }
}

// Default singleton instance
export const iconStorage = new IconStorageService();
