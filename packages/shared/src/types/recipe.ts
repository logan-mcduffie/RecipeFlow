/**
 * Recipe JSONB Type Definitions
 *
 * These types define the structure of recipe data stored in the JSONB `data` field.
 * The `recipeType` column uses a "mod:machine_type" string format for flexibility,
 * but these types provide structure for known recipe formats.
 */

// ==================== BASE TYPES ====================

/** Item with count and optional NBT data */
export interface ItemStack {
  itemId: string; // e.g., "minecraft:iron_ingot"
  count: number;
  nbt?: Record<string, unknown>;
}

/** Fluid with amount in millibuckets */
export interface FluidStack {
  fluidId: string; // e.g., "minecraft:water"
  amount: number; // millibuckets (mB)
}

// ==================== VANILLA RECIPES ====================

/** Shaped crafting recipe (3x3 grid with pattern) */
export interface ShapedCraftingRecipe {
  type: "minecraft:crafting_shaped";
  pattern: string[]; // e.g., ["III", " S ", " S "]
  key: Record<string, ItemStack>; // Map pattern chars to items
  output: ItemStack;
}

/** Shapeless crafting recipe (unordered ingredients) */
export interface ShapelessCraftingRecipe {
  type: "minecraft:crafting_shapeless";
  ingredients: ItemStack[];
  output: ItemStack;
}

/** Furnace/smelting style recipes */
export interface SmeltingRecipe {
  type:
    | "minecraft:smelting"
    | "minecraft:blasting"
    | "minecraft:smoking"
    | "minecraft:campfire_cooking";
  input: ItemStack;
  output: ItemStack;
  experience: number;
  cookingTime: number; // ticks
}

/** Stonecutter recipe */
export interface StonecutterRecipe {
  type: "minecraft:stonecutting";
  input: ItemStack;
  output: ItemStack;
}

/** Smithing table recipe (1.20+ format) */
export interface SmithingRecipe {
  type: "minecraft:smithing_transform" | "minecraft:smithing_trim";
  template: ItemStack;
  base: ItemStack;
  addition: ItemStack;
  output: ItemStack;
}

// ==================== GREGTECH RECIPES ====================

/** GregTech voltage tiers */
export type VoltageTier =
  | "ULV"
  | "LV"
  | "MV"
  | "HV"
  | "EV"
  | "IV"
  | "LuV"
  | "ZPM"
  | "UV"
  | "UHV"
  | "UEV"
  | "UIV"
  | "UXV"
  | "OpV"
  | "MAX";

/** Item output with optional chance */
export interface ChancedItemOutput extends ItemStack {
  chance?: number; // 0-1, where 1 = 100%
  boostPerTier?: number; // Chance increase per voltage tier
}

/** GregTech machine recipe */
export interface GregTechMachineRecipe {
  type: "gregtech:machine";
  machineType: string; // e.g., "electric_blast_furnace", "chemical_reactor"
  voltageTier: VoltageTier;
  euPerTick: number; // EU/t consumption
  duration: number; // ticks
  inputs: {
    items: ItemStack[];
    fluids: FluidStack[];
  };
  outputs: {
    items: ChancedItemOutput[];
    fluids: FluidStack[];
  };
  specialConditions?: {
    cleanroom?: boolean;
    vacuum?: boolean;
    coilTier?: number;
    // Extensible for other mod-specific conditions
    [key: string]: unknown;
  };
}

// ==================== THERMAL SERIES RECIPES ====================

/** Thermal Series machine recipe */
export interface ThermalMachineRecipe {
  type: "thermal:machine";
  machineType: string; // e.g., "pulverizer", "induction_smelter", "centrifuge"
  energy: number; // RF total
  inputs: {
    items: ItemStack[];
    fluids: FluidStack[];
  };
  outputs: {
    items: ChancedItemOutput[];
    fluids: FluidStack[];
  };
}

// ==================== MEKANISM RECIPES ====================

/** Mekanism machine recipe */
export interface MekanismMachineRecipe {
  type: "mekanism:machine";
  machineType: string; // e.g., "crusher", "enrichment_chamber", "chemical_injection_chamber"
  energy: number; // Joules
  duration: number; // ticks
  inputs: {
    items: ItemStack[];
    fluids: FluidStack[];
    gases: Array<{
      gasId: string;
      amount: number;
    }>;
  };
  outputs: {
    items: ChancedItemOutput[];
    fluids: FluidStack[];
    gases: Array<{
      gasId: string;
      amount: number;
    }>;
  };
}

// ==================== GENERIC MACHINE RECIPE ====================

/**
 * Generic machine recipe for unknown/custom mods
 * Use this when the mod isn't explicitly supported
 */
export interface GenericMachineRecipe {
  type: string; // e.g., "create:mixing", "ae2:inscriber"
  machineType?: string;
  energy?: number;
  duration?: number;
  inputs: {
    items: ItemStack[];
    fluids?: FluidStack[];
    [key: string]: unknown;
  };
  outputs: {
    items: Array<ItemStack | ChancedItemOutput>;
    fluids?: FluidStack[];
    [key: string]: unknown;
  };
  conditions?: Record<string, unknown>;
}

// ==================== UNION TYPE ====================

/** All known recipe data types */
export type RecipeData =
  | ShapedCraftingRecipe
  | ShapelessCraftingRecipe
  | SmeltingRecipe
  | StonecutterRecipe
  | SmithingRecipe
  | GregTechMachineRecipe
  | ThermalMachineRecipe
  | MekanismMachineRecipe
  | GenericMachineRecipe;

// ==================== FLOWCHART DATA ====================

/** React Flow node position */
export interface FlowPosition {
  x: number;
  y: number;
}

/** Recipe node in a flowchart */
export interface FlowRecipeNode {
  id: string;
  type: "recipe";
  position: FlowPosition;
  data: {
    recipeId: string;
    /** User-added note for this node (e.g., explaining custom config changes) */
    note?: string;
    // Additional display/config data can be added here
    [key: string]: unknown;
  };
}

/** Edge connecting two nodes */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** Viewport state */
export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Complete flowchart data stored in JSONB */
export interface FlowchartData {
  nodes: FlowRecipeNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
}
