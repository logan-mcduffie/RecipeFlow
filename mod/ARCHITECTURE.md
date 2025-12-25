# RecipeFlow Companion Mod - Architecture Design

## Overview

This document defines the architecture for RecipeFlow's Minecraft Forge companion mod. The mod extracts recipes from loaded mods and exports them to the RecipeFlow web API.

**Design Goals:**
- Multi-version support: 1.7.10 (GTNH), 1.12.2, 1.19+
- Minimal dependencies: HTTP client + JSON only
- Maximum code reuse through clean abstraction layer
- Portable, version-agnostic core

---

## 1. Package Structure

```
com.recipeflow.mod/
├── core/                          # Version-agnostic shared code
│   ├── api/
│   │   ├── RecipeProvider.java    # Interface for recipe extraction
│   │   ├── RecipeData.java        # Base recipe data model
│   │   ├── ItemStackData.java     # Serializable item representation
│   │   ├── FluidStackData.java    # Serializable fluid representation
│   │   └── RecipeType.java        # Recipe type constants
│   ├── model/
│   │   ├── VanillaRecipeData.java # Shaped, shapeless, smelting
│   │   ├── GregTechRecipeData.java# GT machine recipes
│   │   ├── ThermalRecipeData.java # Thermal Series recipes
│   │   ├── MekanismRecipeData.java# Mekanism recipes
│   │   └── GenericRecipeData.java # Catch-all for other mods
│   ├── export/
│   │   ├── HttpExporter.java      # HTTP client for API
│   │   ├── RecipeSerializer.java  # JSON serialization
│   │   └── ExportResult.java      # Result/error handling
│   ├── config/
│   │   ├── ModConfig.java         # Configuration interface
│   │   └── ConfigKeys.java        # Config key constants
│   ├── command/
│   │   └── CommandHandler.java    # Abstract command handler
│   ├── registry/
│   │   └── ProviderRegistry.java  # Provider discovery/execution
│   └── util/
│       ├── HashUtil.java          # Recipe set hashing
│       └── VersionDetector.java   # Modpack version detection
│
├── v1710/                         # 1.7.10-specific (GTNH/NEI)
│   ├── RecipeFlowMod1710.java     # Mod entry point
│   ├── provider/
│   │   ├── NEIRecipeProvider.java # NEI handler integration
│   │   ├── GT5RecipeProvider.java # GT5-Unofficial direct API
│   │   └── VanillaRecipeProvider1710.java
│   ├── command/
│   │   └── SyncCommand1710.java   # Command registration
│   └── config/
│       └── ForgeConfig1710.java   # Forge config wrapper
│
├── v1122/                         # 1.12.2-specific (JEI)
│   ├── RecipeFlowMod1122.java
│   ├── provider/
│   │   ├── JEIRecipeProvider.java # JEI registry integration
│   │   ├── GTCERecipeProvider.java# GregTech CE direct API
│   │   └── VanillaRecipeProvider1122.java
│   ├── command/
│   │   └── SyncCommand1122.java
│   └── config/
│       └── ForgeConfig1122.java
│
└── v119plus/                      # 1.19+ (EMI/JEI)
    ├── RecipeFlowMod119.java
    ├── provider/
    │   ├── EMIRecipeProvider.java # EMI API integration
    │   ├── JEIRecipeProvider119.java # JEI fallback
    │   ├── GTCEuRecipeProvider.java  # GregTech Modern
    │   └── VanillaRecipeProvider119.java
    ├── command/
    │   └── SyncCommand119.java
    └── config/
        └── ForgeConfig119.java
```

---

## 2. Core Interfaces

### 2.1 RecipeProvider

```java
package com.recipeflow.mod.core.api;

/**
 * Interface for extracting recipes from a specific source.
 * Each implementation handles a particular mod or recipe system.
 */
public interface RecipeProvider {

    /** Unique identifier (e.g., "gregtech", "vanilla", "thermal") */
    String getProviderId();

    /** Human-readable name for logging */
    String getProviderName();

    /** Check if this provider is available (mod loaded, API accessible) */
    boolean isAvailable();

    /** Extract all recipes from this source */
    List<RecipeData> extractRecipes();

    /** Extract recipes for a specific output item */
    List<RecipeData> extractRecipesFor(String itemId);

    /** Priority for ordering (higher = processed first) */
    default int getPriority() { return 0; }
}
```

### 2.2 RecipeData

```java
package com.recipeflow.mod.core.api;

/**
 * Base class for all recipe data models.
 * Designed to serialize to JSON matching the TypeScript API types.
 */
public abstract class RecipeData {

    protected String id;        // e.g., "gtceu:chemical_reactor/sodium_hydroxide"
    protected String type;      // e.g., "minecraft:crafting_shaped"
    protected String sourceMod; // e.g., "gregtech"

    public abstract String getId();
    public abstract String getType();
    public abstract String getSourceMod();

    /** Convert to JSON-serializable map matching API contract */
    public abstract Map<String, Object> toJsonMap();
}
```

### 2.3 ItemStackData / FluidStackData

```java
/** Matches TypeScript ItemStack type */
public class ItemStackData {
    private String itemId;              // e.g., "minecraft:iron_ingot"
    private int count;
    private Map<String, Object> nbt;    // Optional NBT data
}

/** Matches TypeScript FluidStack type */
public class FluidStackData {
    private String fluidId;             // e.g., "minecraft:water"
    private int amount;                 // millibuckets
}
```

### 2.4 HttpExporter

```java
package com.recipeflow.mod.core.export;

/**
 * HTTP client for sending recipe data to the RecipeFlow API.
 * Uses Java's HttpURLConnection for maximum compatibility.
 */
public class HttpExporter {

    private final String serverUrl;
    private final String authToken;
    private final String modpackSlug;

    public HttpExporter(ModConfig config) { ... }

    /**
     * Sync recipes to the API.
     * POST /api/modpacks/{slug}/versions/{version}/recipes/sync
     */
    public ExportResult syncRecipes(
        List<RecipeData> recipes,
        String modpackVersion,
        ProgressCallback progressCallback
    );

    /** Async version for non-blocking operation */
    public CompletableFuture<ExportResult> syncRecipesAsync(...);

    public interface ProgressCallback {
        void onProgress(int current, int total, String message);
    }
}

/** Result of an export operation */
public class ExportResult {
    private boolean success;
    private int recipesUploaded;
    private int recipesNew;
    private int recipesUpdated;
    private String errorMessage;
    private String contentHash;
}
```

### 2.5 CommandHandler

```java
package com.recipeflow.mod.core.command;

/**
 * Abstract command handler for /recipeflow commands.
 * Version-specific implementations handle registration.
 */
public abstract class CommandHandler {

    /** Execute the sync command */
    public void executeSync(CommandContext context) {
        // 1. Collect recipes from all providers
        // 2. Detect modpack version
        // 3. Export to server
        // 4. Report result
    }

    /** Register the command (version-specific) */
    public abstract void register();

    public interface CommandContext {
        void sendMessage(String message);
        void sendError(String message);
        void sendProgress(int current, int total, String message);
        boolean hasPermission(String permission);
    }
}
```

### 2.6 ModConfig

```java
package com.recipeflow.mod.core.config;

/**
 * Configuration interface for RecipeFlow mod settings.
 */
public interface ModConfig {

    // Required
    String getServerUrl();
    String getAuthToken();
    String getModpackSlug();

    // Optional with defaults
    default int getBatchSize() { return 1000; }
    default int getTimeoutMs() { return 30000; }
    default boolean isCompressionEnabled() { return true; }
    default boolean isDebugLogging() { return false; }

    /** Validate configuration is complete */
    ValidationResult validate();
}
```

---

## 3. Data Models

### 3.1 GregTechRecipeData

Matches TypeScript `GregTechMachineRecipe`:

```java
public class GregTechRecipeData extends RecipeData {

    public enum VoltageTier {
        ULV, LV, MV, HV, EV, IV, LuV, ZPM, UV, UHV, UEV, UIV, UXV, OpV, MAX
    }

    private String machineType;         // e.g., "electric_blast_furnace"
    private VoltageTier voltageTier;
    private int euPerTick;
    private int duration;               // ticks

    private List<ItemStackData> inputItems;
    private List<FluidStackData> inputFluids;
    private List<ChancedItemOutput> outputItems;
    private List<FluidStackData> outputFluids;

    private SpecialConditions specialConditions;

    public static class ChancedItemOutput extends ItemStackData {
        private Double chance;          // 0-1, null = 100%
        private Double boostPerTier;
    }

    public static class SpecialConditions {
        private Boolean cleanroom;
        private Boolean vacuum;
        private Integer coilTier;
        private Map<String, Object> extra;
    }

    @Override
    public String getType() { return "gregtech:machine"; }
}
```

### 3.2 VanillaRecipeData

Matches TypeScript vanilla recipe types:

```java
public class VanillaRecipeData extends RecipeData {

    // For shaped crafting
    private String[] pattern;           // e.g., ["III", " S ", " S "]
    private Map<String, ItemStackData> key;

    // For shapeless crafting
    private List<ItemStackData> ingredients;

    // For smelting
    private ItemStackData input;
    private double experience;
    private int cookingTime;

    // Output (all types)
    private ItemStackData output;
}
```

### 3.3 GenericRecipeData

Catch-all for unsupported mods:

```java
public class GenericRecipeData extends RecipeData {

    private String machineType;
    private Integer energy;
    private Integer duration;

    private Map<String, Object> inputs;
    private Map<String, Object> outputs;
    private Map<String, Object> conditions;
}
```

---

## 4. Provider Priority System

Providers are processed in priority order. Higher priority providers are queried first, and their recipes take precedence for deduplication.

| Priority | Provider Type | Examples |
|----------|--------------|----------|
| 100 | Direct mod API | GT5RecipeProvider, GTCERecipeProvider, GTCEuRecipeProvider |
| 50 | Recipe viewer | NEIRecipeProvider, JEIRecipeProvider, EMIRecipeProvider |
| 10 | Vanilla fallback | VanillaRecipeProvider |

### Provider Registry

```java
public class ProviderRegistry {

    private final List<RecipeProvider> providers = new ArrayList<>();

    public void register(RecipeProvider provider) {
        if (provider.isAvailable()) {
            providers.add(provider);
            providers.sort(Comparator.comparingInt(
                RecipeProvider::getPriority
            ).reversed());
        }
    }

    /**
     * Extract recipes from all providers with deduplication.
     * Higher-priority providers take precedence.
     */
    public List<RecipeData> extractAllRecipes(ExtractionCallback callback) {
        Map<String, RecipeData> recipes = new LinkedHashMap<>();

        for (RecipeProvider provider : providers) {
            List<RecipeData> extracted = provider.extractRecipes();
            for (RecipeData recipe : extracted) {
                recipes.putIfAbsent(recipe.getId(), recipe);
            }
            callback.onProviderComplete(provider, extracted.size());
        }

        return new ArrayList<>(recipes.values());
    }
}
```

---

## 5. Version-Specific Implementations

### 5.1 Code Distribution

| Component | Shared (core/) | Version-Specific |
|-----------|---------------|------------------|
| RecipeData models | Yes | No |
| ItemStackData/FluidStackData | Yes | No |
| HttpExporter | Yes | No |
| JSON serialization | Yes | No |
| RecipeProvider interface | Yes | No |
| Config interface | Yes | Wrapper implementations |
| Command logic | Yes | Registration only |
| NEI/JEI/EMI integration | No | Yes |
| GregTech API access | No | Yes (different APIs) |
| Mod entry point | No | Yes |

### 5.2 Recipe Viewer Integration

**1.7.10 (NEI):**
- Iterate `GuiRecipe` handlers
- Access `PositionedStack` for inputs/outputs
- Use reflection for mod-specific handlers

**1.12.2 (JEI):**
- Use `IRecipeRegistry` from JEI runtime
- Query `IRecipeCategory` for all categories
- Access `IRecipeWrapper` for recipe data

**1.19+ (EMI):**
- Use `EmiApi.getRecipeManager()`
- Iterate `EmiRecipeCategory` entries
- Access `EmiRecipe` inputs/outputs

### 5.3 GregTech Integration

**1.7.10 (GT5-Unofficial):**
```java
// Access GT_Recipe.GT_Recipe_Map.sMappings
for (GT_Recipe.GT_Recipe_Map recipeMap : GT_Recipe.GT_Recipe_Map.sMappings.values()) {
    for (GT_Recipe recipe : recipeMap.mRecipeList) {
        // recipe.mEUt, recipe.mDuration, recipe.mInputs, etc.
    }
}
```

**1.12.2 (GregTech CE):**
```java
// Access RecipeMaps registry
for (RecipeMap<?> recipeMap : RecipeMaps.getRecipeMaps()) {
    for (Recipe recipe : recipeMap.getRecipeList()) {
        // recipe.getEUt(), recipe.getDuration(), etc.
    }
}
```

**1.19+ (GTCEu Modern):**
```java
// Access GTRecipeTypes registry
for (GTRecipeType recipeType : GTRecipeTypes.RECIPE_TYPES.values()) {
    for (GTRecipe recipe : recipeType.getAllRecipes()) {
        // recipe.duration, recipe.EUt(), etc.
    }
}
```

---

## 6. Build System

### 6.1 Multi-Project Gradle Structure

```
mod/
├── build.gradle.kts           # Root build file
├── settings.gradle.kts        # Multi-project settings
├── gradle.properties          # Shared properties
│
├── core/                      # Shared code (Java library)
│   ├── build.gradle.kts
│   └── src/main/java/
│
├── forge-1.7.10/              # 1.7.10 mod
│   ├── build.gradle.kts       # Uses GTNH Gradle plugin
│   └── src/main/java/
│
├── forge-1.12.2/              # 1.12.2 mod
│   ├── build.gradle.kts       # ForgeGradle 5.x
│   └── src/main/java/
│
└── forge-1.19/                # 1.19+ mod
    ├── build.gradle.kts       # ForgeGradle 6.x
    └── src/main/java/
```

### 6.2 settings.gradle.kts

```kotlin
rootProject.name = "recipeflow-mod"

include("core")
include("forge-1.7.10")
include("forge-1.12.2")
include("forge-1.19")
```

### 6.3 Core Module

```kotlin
// core/build.gradle.kts
plugins {
    java
}

java {
    sourceCompatibility = JavaVersion.VERSION_1_8
    targetCompatibility = JavaVersion.VERSION_1_8
}

dependencies {
    implementation("com.google.code.gson:gson:2.8.9")
}
```

### 6.4 Version Modules

**1.7.10:**
```kotlin
plugins {
    id("com.gtnewhorizons.gtnhgradle") version "1.0.+"
}

dependencies {
    implementation(project(":core"))
    compileOnly("codechicken:NotEnoughItems:1.7.10-1.0.5.120:dev")
    compileOnly("com.github.GTNewHorizons:GT5-Unofficial:5.09.+:dev")
}
```

**1.12.2:**
```kotlin
plugins {
    id("net.minecraftforge.gradle") version "5.+"
}

minecraft {
    version = "1.12.2-14.23.5.2860"
    mappings = "stable_39"
}

dependencies {
    implementation(project(":core"))
    compileOnly("mezz.jei:jei_1.12.2:4.16.+:api")
    compileOnly("gregtech:gregtech:1.12.2-2.+:dev")
}
```

**1.19+:**
```kotlin
plugins {
    id("net.minecraftforge.gradle") version "6.+"
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation(project(":core"))
    compileOnly("dev.emi:emi-forge:1.0.+:api")
    compileOnly("mezz.jei:jei-1.19.2-forge:11.+:api")
    compileOnly("com.gregtechceu.gtceu:gtceu-1.19.2:1.+")
}
```

---

## 7. Configuration

### 7.1 Config File Locations

| Version | Format | Path |
|---------|--------|------|
| 1.7.10 | .cfg | `config/recipeflow.cfg` |
| 1.12.2 | .toml | `config/recipeflow.toml` |
| 1.19+ | .toml | `config/recipeflow-common.toml` |

### 7.2 Config Structure

```toml
[server]
# RecipeFlow server URL
url = "https://recipeflow.example.com"

# Authentication token (from web app settings)
authToken = ""

# Modpack identifier (slug from web app)
modpackSlug = "my-modpack"

[sync]
# Recipes per batch
batchSize = 1000

# HTTP timeout (ms)
timeoutMs = 30000

# Enable GZIP compression
compression = true

[advanced]
# Enable debug logging
debug = false

# Override detected modpack version
versionOverride = ""
```

---

## 8. API Integration

### 8.1 Sync Request

```
POST /api/modpacks/{slug}/versions/{version}/recipes/sync
Authorization: Bearer {authToken}
Content-Type: application/json
Content-Encoding: gzip
```

**Request Body:**
```json
{
  "contentHash": "sha256:abc123...",
  "recipeCount": 5234,
  "recipes": [
    {
      "id": "minecraft:crafting/iron_ingot_from_block",
      "type": "minecraft:crafting_shapeless",
      "ingredients": [{"itemId": "minecraft:iron_block", "count": 1}],
      "output": {"itemId": "minecraft:iron_ingot", "count": 9}
    },
    {
      "id": "gtceu:chemical_reactor/sodium_hydroxide",
      "type": "gregtech:machine",
      "machineType": "chemical_reactor",
      "voltageTier": "LV",
      "euPerTick": 30,
      "duration": 100,
      "inputs": {
        "items": [{"itemId": "gtceu:sodium_dust", "count": 1}],
        "fluids": [{"fluidId": "minecraft:water", "amount": 1000}]
      },
      "outputs": {
        "items": [{"itemId": "gtceu:sodium_hydroxide_dust", "count": 1}],
        "fluids": [{"fluidId": "gtceu:hydrogen", "amount": 1000}]
      }
    }
  ]
}
```

### 8.2 Response

```json
{
  "success": true,
  "stats": {
    "received": 5234,
    "new": 234,
    "updated": 12,
    "unchanged": 4988
  },
  "contentHash": "sha256:abc123...",
  "version": "1.2.3"
}
```

---

## 9. Implementation Sequence

### Phase 1: Core Infrastructure
1. Implement data models (RecipeData, ItemStackData, FluidStackData)
2. Implement GregTechRecipeData, VanillaRecipeData, GenericRecipeData
3. Implement HttpExporter with GZIP compression
4. Implement RecipeSerializer (JSON via Gson)
5. Create ModConfig interface and ConfigKeys

### Phase 2: 1.19+ Implementation
1. Set up forge-1.19 Gradle module
2. Implement EMIRecipeProvider
3. Implement GTCEuRecipeProvider
4. Implement VanillaRecipeProvider119
5. Implement SyncCommand119
6. Test end-to-end sync

### Phase 3: Backport to 1.12.2
1. Set up forge-1.12.2 Gradle module
2. Implement JEIRecipeProvider
3. Implement GTCERecipeProvider
4. Adapt command registration

### Phase 4: Backport to 1.7.10
1. Set up forge-1.7.10 Gradle module (GTNH tooling)
2. Implement NEIRecipeProvider
3. Implement GT5RecipeProvider
4. Adapt command registration

---

## 10. Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Gson | 2.8.9 | JSON serialization |
| NEI (1.7.10) | 1.0.5+ | Recipe handler access |
| GT5-Unofficial | 5.09+ | Direct GT recipe access |
| JEI (1.12.2) | 4.16+ | Recipe registry access |
| GregTech CE | 2.x | Direct GT recipe access |
| EMI (1.19+) | 1.0+ | Recipe registry access |
| JEI (1.19+) | 11+ | Fallback recipe access |
| GTCEu Modern | 1.x | Direct GT recipe access |

---

## 11. Potential Challenges

| Challenge | Mitigation |
|-----------|-----------|
| Large recipe counts (10k+) | Batch uploads, GZIP, progress feedback |
| Memory pressure | Stream processing, don't hold all in memory |
| Mod API changes | Version-specific modules, compile-only deps |
| NEI scraping unreliability | Prefer direct mod APIs, fallback to NEI |
| NBT complexity | Serialize raw NBT as JSON object |
| Auth token security | Config file permissions, warn user |
| Version detection | Multiple fallbacks, config override |
