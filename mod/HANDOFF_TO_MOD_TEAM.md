# Handoff to MC Mod Team (v2)

**Date:** 2024-12-24
**From:** Web App Team
**Status:** Required before Phase 3 can proceed

---

## Overview

After reviewing the original handoff, we identified several gaps that need to be addressed before the web app can properly receive and display recipe data. This document outlines the requirements.

---

## Required Changes

### 1. Add `circuit` field to GregTech recipes

Extract the programmed circuit number (1-32) from GTCEu recipes. Add it either:
- As `circuit` field on `GregTechRecipeData`, OR
- As `circuit` in `specialConditions`

Either location works - web app will check both.

**Why:** Many GT recipes share identical inputs/outputs but differ only by circuit. Without this, users can't distinguish between recipes.

**Effort:** ~30 minutes

---

### 2. Add `manifestHash` to sync request

Hash of the modpack's mod list for verification. This enables us to detect if a user has modified their pack vs running the official CurseForge/Modrinth version.

**Updated request body:**
```json
{
  "contentHash": "sha256:...",
  "manifestHash": "sha256:...",
  "recipeCount": 5234,
  "recipes": [...]
}
```

**How to compute:**
1. Read `manifest.json` (CurseForge) or `pack.toml` (Modrinth)
2. Extract mod list (project IDs + file IDs or versions)
3. Sort alphabetically
4. SHA-256 hash the sorted list

**Why:** Protects community content integrity. Prevents modified packs from overwriting verified recipe data. Flowcharts shared by the community will work reliably for users running the official pack.

**Effort:** ~1-2 hours

---

### 3. Include item metadata (names + tooltips)

For each unique item referenced in recipes, send:

| Field | Type | Example | Source |
|-------|------|---------|--------|
| `itemId` | string | `"gtceu:sodium_hydroxide_dust"` | Registry name |
| `displayName` | string | `"Sodium Hydroxide Dust"` | `ItemStack.getHoverName()` |
| `tooltip` | string[] | `["Chemical Formula: NaOH", "Melting Point: 596K"]` | `ItemStack.getTooltipLines()` |

**Request:**
```json
{
  "items": [
    {
      "itemId": "gtceu:sodium_hydroxide_dust",
      "displayName": "Sodium Hydroxide Dust",
      "tooltip": ["Chemical Formula: NaOH", "Melting Point: 596K"]
    },
    {
      "itemId": "minecraft:iron_ingot",
      "displayName": "Iron Ingot",
      "tooltip": []
    }
  ]
}
```

**Why:** Users need to see "Sodium Hydroxide Dust" not `gtceu:sodium_hydroxide_dust`. Tooltips show important info like GT chemical formulas, melting points, etc.

**Effort:** ~1-2 hours

---

### 4. Implement icon upload

Upload exported icons to the API. Icons are matched to items by `itemId`.

**Supported formats:**
- PNG for static items
- WebP or APNG for animated items (fluids, enchant glint, etc.)

**Naming convention:** `{itemId_with_underscores}.png` (e.g., `gtceu_sodium_hydroxide_dust.png`)

**Why:** Icons are half the user experience. Nobody wants to read registry names when they could see the actual item sprite.

**Effort:** ~2-3 hours

---

### 5. Chunked/Resumable Upload Protocol

For large payloads (icons especially, potentially 50-200MB for big modpacks), implement chunked uploads with hash verification.

**Why:**
- Large uploads over home connections will fail without resumability
- Users shouldn't restart from scratch when upload fails at 90%
- Per-chunk hashing catches corruption early
- Enables meaningful progress feedback ("Chunk 7/12" vs "Uploading...")

**Effort:** ~3-4 hours

---

#### 5.1 Start Upload Session

```
POST /api/modpacks/:slug/versions/:version/upload/start

Request:
{
  "type": "icons" | "items" | "recipes",
  "totalSize": 52428800,
  "totalChunks": 10,
  "chunkSize": 5242880,
  "finalHash": "sha256:abc123..."
}

Response:
{
  "sessionId": "uuid-here",
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

---

#### 5.2 Upload Chunk

```
POST /api/modpacks/:slug/versions/:version/upload/:sessionId/chunk/:chunkIndex

Headers:
  Content-Type: application/octet-stream
  X-Chunk-Hash: sha256:def456...

Body: [binary chunk data]

Response:
{
  "chunkIndex": 5,
  "verified": true,
  "chunksReceived": 6,
  "chunksRemaining": 4
}

Error Response (hash mismatch):
{
  "error": "HASH_MISMATCH",
  "expected": "sha256:def456...",
  "received": "sha256:xyz789...",
  "retryable": true
}
```

---

#### 5.3 Check Session Status (for resume)

```
GET /api/modpacks/:slug/versions/:version/upload/:sessionId/status

Response:
{
  "sessionId": "uuid-here",
  "type": "icons",
  "chunksReceived": [0, 1, 2, 3, 4],
  "chunksMissing": [5, 6, 7, 8, 9],
  "totalChunks": 10,
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

---

#### 5.4 Complete Upload

```
POST /api/modpacks/:slug/versions/:version/upload/:sessionId/complete

Response (success):
{
  "success": true,
  "finalHashVerified": true,
  "itemsProcessed": 5234
}

Response (incomplete):
{
  "success": false,
  "error": "CHUNKS_MISSING",
  "chunksMissing": [7, 8]
}

Response (corruption):
{
  "success": false,
  "error": "FINAL_HASH_MISMATCH",
  "expected": "sha256:abc123...",
  "received": "sha256:wrong..."
}
```

---

#### 5.5 Chunk Size Recommendation

| Payload Type | Recommended Chunk Size | Rationale |
|--------------|------------------------|-----------|
| Recipes JSON | 5 MB | Text compresses well, larger chunks OK |
| Item metadata | 2 MB | Smaller payload, fewer chunks needed |
| Icons (zip) | 5 MB | Balance between progress feedback and overhead |

---

## Summary Table

| Requirement | Priority | Effort Estimate |
|-------------|----------|-----------------|
| `circuit` field | High | ~30 min |
| `manifestHash` | High | ~1-2 hours |
| Item metadata (names + tooltips) | High | ~1-2 hours |
| Icon upload | High | ~2-3 hours |
| Chunked/resumable protocol | High | ~3-4 hours |

**Total mod team effort: ~8-12 hours**

---

## Deferred to v1.1

- Full NBT extraction for items (enchantments, custom data beyond circuits)
- Delta/incremental icon sync (only upload changed icons)
- Icon deduplication by content hash across modpack versions

---

## No Changes Needed

These are confirmed correct from the original handoff:
- JSON structure uses `inputs.items` / `outputs.items` (nested)
- `boostPerTier` field name for chanced outputs
- Recipe type identifiers (`minecraft:crafting_shaped`, `gregtech:machine`, etc.)
- Base API endpoint paths
- Auth header format (`Authorization: Bearer {token}`)
- GZIP compression for request bodies

---

## Complete Sync Flow

```
Player runs /recipeflow sync
         |
         v
+-------------------------------------+
| 1. Extract recipes                  |
|    - Include circuit field for GT   |
|    - Compute contentHash            |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 2. Compute manifestHash             |
|    - Read manifest.json/pack.toml   |
|    - Hash sorted mod list           |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 3. Upload recipes                   |
|    POST .../recipes/sync            |
|    (single request, GZIP body)      |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 4. Start items upload session       |
|    POST .../upload/start            |
|    { type: "items", ... }           |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 5. Upload item metadata chunks      |
|    POST .../upload/:id/chunk/:n     |
|    (names, tooltips for all items)  |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 6. Complete items upload            |
|    POST .../upload/:id/complete     |
|    (verify final hash)              |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 7. Start icons upload session       |
|    POST .../upload/start            |
|    { type: "icons", ... }           |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 8. Upload icon chunks               |
|    POST .../upload/:id/chunk/:n     |
|    (batched as zip or multipart)    |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 9. Complete icons upload            |
|    POST .../upload/:id/complete     |
|    (verify final hash)              |
+-------------------------------------+
         |
         v
+-------------------------------------+
| 10. Show success to player          |
|     "Synced 5,234 recipes,          |
|      4,891 items with icons"        |
+-------------------------------------+
```

---

## Progress Feedback to Player

The mod should show progress at each stage:

```
[RecipeFlow] Extracting recipes... 5,234 found
[RecipeFlow] Computing manifest hash...
[RecipeFlow] Uploading recipes... done (2.3 MB)
[RecipeFlow] Uploading item metadata... chunk 2/3
[RecipeFlow] Uploading item metadata... done
[RecipeFlow] Uploading icons... chunk 4/12 (33%)
[RecipeFlow] Uploading icons... chunk 8/12 (67%)
[RecipeFlow] Uploading icons... done (48.2 MB)
[RecipeFlow] Verifying upload integrity... passed
[RecipeFlow] Sync complete! 5,234 recipes, 4,891 items
```

---

## Questions?

Reach out to the web app team if anything is unclear. Once all five requirements are implemented, we're ready to proceed with Phase 3 (Recipe Management API).
