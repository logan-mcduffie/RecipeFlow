/**
 * Item metadata types for display and icon association
 */

/** Item metadata from the companion mod */
export interface ItemMetadata {
  itemId: string; // e.g., "gtceu:sodium_hydroxide_dust"
  displayName: string; // Localized display name
  tooltipLines: string[]; // Array of tooltip lines (excluding display name)
}

/** Bulk item metadata payload from the mod */
export interface ItemMetadataPayload {
  items: ItemMetadata[];
}

/** Item with icon URL for frontend consumption */
export interface ItemWithIcon extends ItemMetadata {
  iconUrl: string | null;
}

/** Icon metadata from the mod's ZIP archive */
export interface IconMetadata {
  filename: string; // e.g., "minecraft_iron_ingot.png"
  animated: boolean;
  frameCount: number;
  frameTimeMs: number;
}

/** Icon metadata payload (icon-metadata.json inside ZIP) */
export interface IconMetadataPayload {
  [itemId: string]: IconMetadata;
}
