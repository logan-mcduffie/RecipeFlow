/**
 * Item metadata import service
 *
 * Handles importing item display names, tooltips, and icon associations
 * from the companion mod's uploaded data.
 */

import { readFile } from "fs/promises";
import type { FastifyInstance } from "fastify";
import type { ItemMetadataPayload, ItemMetadata } from "@recipeflow/shared";

// Type inferred from Prisma query
type Item = NonNullable<Awaited<ReturnType<FastifyInstance["prisma"]["item"]["findUnique"]>>>;

// ==================== TYPES ====================

export interface ItemImportResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
}

export interface LinkIconsResult {
  linked: number;
  notFound: number;
}

// ==================== SERVICE FUNCTIONS ====================

/**
 * Parse item metadata JSON from uploaded file
 */
export async function parseItemsFile(filePath: string): Promise<ItemMetadataPayload> {
  const content = await readFile(filePath, "utf-8");
  const data = JSON.parse(content) as ItemMetadataPayload;

  // Validate structure
  if (!data.items || !Array.isArray(data.items)) {
    throw new Error("Invalid items file: expected 'items' array");
  }

  // Validate each item has required fields
  for (const [i, item] of data.items.entries()) {
    if (!item || !item.itemId || typeof item.itemId !== "string") {
      throw new Error(`Invalid item at index ${i}: missing or invalid 'itemId'`);
    }
    if (!item.displayName || typeof item.displayName !== "string") {
      throw new Error(`Invalid item at index ${i}: missing or invalid 'displayName'`);
    }
    if (!Array.isArray(item.tooltipLines)) {
      // Allow missing tooltipLines, default to empty array
      item.tooltipLines = [];
    }
  }

  return data;
}

/**
 * Import item metadata into the database
 *
 * Performs upserts to handle both new and updated items.
 */
export async function importItems(
  fastify: FastifyInstance,
  modpackVersionId: string,
  payload: ItemMetadataPayload,
): Promise<ItemImportResult> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  // Process in batches for performance
  const BATCH_SIZE = 100;

  for (let i = 0; i < payload.items.length; i += BATCH_SIZE) {
    const batch = payload.items.slice(i, i + BATCH_SIZE);

    // Fetch existing items for this batch
    const itemIds = batch.map((item) => item.itemId);
    const existingItems = await fastify.prisma.item.findMany({
      where: {
        modpackVersionId,
        itemId: { in: itemIds },
      },
    });

    const existingMap = new Map(existingItems.map((item) => [item.itemId, item]));

    // Process each item in the batch
    for (const item of batch) {
      const existing = existingMap.get(item.itemId);

      if (!existing) {
        // New item - create it
        await fastify.prisma.item.create({
          data: {
            modpackVersionId,
            itemId: item.itemId,
            displayName: item.displayName,
            tooltip: item.tooltipLines,
          },
        });
        created++;
      } else {
        // Existing item - check for changes
        const hasChanges = hasItemChanged(existing, item);

        if (hasChanges) {
          await fastify.prisma.item.update({
            where: { id: existing.id },
            data: {
              displayName: item.displayName,
              tooltip: item.tooltipLines,
            },
          });
          updated++;
        } else {
          unchanged++;
        }
      }
    }
  }

  return {
    total: payload.items.length,
    created,
    updated,
    unchanged,
  };
}

/**
 * Check if an item has changed compared to existing data
 */
function hasItemChanged(existing: Item, incoming: ItemMetadata): boolean {
  if (existing.displayName !== incoming.displayName) return true;

  // Compare tooltip arrays
  const existingTooltip = existing.tooltip;
  const incomingTooltip = incoming.tooltipLines;

  if (existingTooltip.length !== incomingTooltip.length) return true;

  for (let i = 0; i < existingTooltip.length; i++) {
    if (existingTooltip[i] !== incomingTooltip[i]) return true;
  }

  return false;
}

/**
 * Link icons to items by updating iconFilename
 *
 * @param icons - Array of { itemId, filename } pairs
 */
export async function linkIconsToItems(
  fastify: FastifyInstance,
  modpackVersionId: string,
  icons: Array<{ itemId: string; filename: string }>,
): Promise<LinkIconsResult> {
  let linked = 0;
  let notFound = 0;

  // Process in batches
  const BATCH_SIZE = 100;

  for (let i = 0; i < icons.length; i += BATCH_SIZE) {
    const batch = icons.slice(i, i + BATCH_SIZE);

    for (const icon of batch) {
      const result = await fastify.prisma.item.updateMany({
        where: {
          modpackVersionId,
          itemId: icon.itemId,
        },
        data: {
          iconFilename: icon.filename,
        },
      });

      if (result.count > 0) {
        linked++;
      } else {
        notFound++;
      }
    }
  }

  return { linked, notFound };
}

/**
 * Get item count for a modpack version
 */
export async function getItemCount(
  fastify: FastifyInstance,
  modpackVersionId: string,
): Promise<number> {
  return fastify.prisma.item.count({
    where: { modpackVersionId },
  });
}

/**
 * Delete all items for a modpack version
 */
export async function deleteAllItems(
  fastify: FastifyInstance,
  modpackVersionId: string,
): Promise<number> {
  const result = await fastify.prisma.item.deleteMany({
    where: { modpackVersionId },
  });

  return result.count;
}

/**
 * Get items with missing icons
 */
export async function getItemsWithoutIcons(
  fastify: FastifyInstance,
  modpackVersionId: string,
): Promise<Item[]> {
  return fastify.prisma.item.findMany({
    where: {
      modpackVersionId,
      iconFilename: null,
    },
  });
}
