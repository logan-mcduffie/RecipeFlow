/**
 * Database seed script
 *
 * NOTE: If you see TypeScript errors about missing properties (manifestHash, isVerified, etc.),
 * run `pnpm db:generate` to regenerate the Prisma client after schema changes.
 */
import "dotenv/config";
import { PrismaClient, OAuthProvider } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type {
  ShapedCraftingRecipe,
  GregTechMachineRecipe,
  FlowchartData,
} from "@recipeflow/shared";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...\n");

  // ==================== MODPACK ====================
  const testModpack = await prisma.modpack.upsert({
    where: { slug: "test-modpack" },
    update: {},
    create: {
      slug: "test-modpack",
      name: "Test Modpack",
      description: "A test modpack for development",
    },
  });
  console.log(`Created modpack: ${testModpack.name} (${testModpack.slug})`);

  // ==================== USER ====================
  // Create user first so we can reference them as syncer
  const testUser = await prisma.user.upsert({
    where: {
      oauthProvider_oauthId: {
        oauthProvider: OAuthProvider.DISCORD,
        oauthId: "123456789012345678",
      },
    },
    update: {},
    create: {
      oauthProvider: OAuthProvider.DISCORD,
      oauthId: "123456789012345678",
      username: "TestUser",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
    },
  });
  console.log(`Created user: ${testUser.username}`);

  // ==================== MODPACK VERSION ====================
  // Find existing or create new version
  let testVersion = await prisma.modpackVersion.findFirst({
    where: {
      modpackId: testModpack.id,
      version: "1.0.0",
    },
  });

  if (!testVersion) {
    testVersion = await prisma.modpackVersion.create({
      data: {
        modpackId: testModpack.id,
        version: "1.0.0",
        recipeHash: "sha256:recipes123",
        manifestHash: "sha256:abc123def456",
        isVerified: true,
        syncedById: testUser.id,
      },
    });
    console.log(`Created version: ${testVersion.version} (verified: ${testVersion.isVerified})`);
  } else {
    console.log(`Version already exists: ${testVersion.version}`);
  }

  // ==================== RECIPES ====================

  // Shaped crafting recipe
  const shapedRecipeData: ShapedCraftingRecipe = {
    type: "minecraft:crafting_shaped",
    pattern: ["III", " S ", " S "],
    key: {
      I: { itemId: "minecraft:iron_ingot", count: 1 },
      S: { itemId: "minecraft:stick", count: 1 },
    },
    output: { itemId: "minecraft:iron_pickaxe", count: 1 },
  };

  const shapedRecipe = await prisma.recipe.create({
    data: {
      modpackVersionId: testVersion.id,
      itemId: "minecraft:iron_pickaxe",
      recipeType: "minecraft:crafting_shaped",
      data: shapedRecipeData,
    },
  });
  console.log(`Created recipe: ${shapedRecipe.recipeType} -> ${shapedRecipe.itemId}`);

  // GregTech machine recipe
  const gtRecipeData: GregTechMachineRecipe = {
    type: "gregtech:machine",
    machineType: "electric_blast_furnace",
    voltageTier: "MV",
    euPerTick: 120,
    duration: 1200,
    inputs: {
      items: [{ itemId: "gregtech:dust_iron", count: 1 }],
      fluids: [{ fluidId: "gtceu:oxygen", amount: 1000 }],
    },
    outputs: {
      items: [{ itemId: "gregtech:ingot_steel", count: 1 }],
      fluids: [],
    },
    specialConditions: {
      coilTier: 2,
    },
  };

  const gtRecipe = await prisma.recipe.create({
    data: {
      modpackVersionId: testVersion.id,
      itemId: "gregtech:ingot_steel",
      recipeType: "gregtech:electric_blast_furnace",
      data: gtRecipeData,
    },
  });
  console.log(`Created recipe: ${gtRecipe.recipeType} -> ${gtRecipe.itemId}`);

  // ==================== FLOWCHART ====================
  const flowchartData: FlowchartData = {
    nodes: [
      {
        id: "node-1",
        type: "recipe",
        position: { x: 0, y: 0 },
        data: { recipeId: gtRecipe.id },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const flowchart = await prisma.flowchart.create({
    data: {
      userId: testUser.id,
      modpackVersionId: testVersion.id,
      name: "Test Flowchart",
      description: "A sample flowchart showing basic steel production",
      isPublic: true,
      data: flowchartData,
    },
  });
  console.log(`Created flowchart: ${flowchart.name}`);

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
