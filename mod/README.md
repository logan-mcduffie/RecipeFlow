# RecipeFlow Companion Mod

Forge mod for automatic recipe extraction from Minecraft modpacks.

## Features

- Recipe extraction from loaded mods (vanilla, GregTech, Thermal, Mekanism, etc.)
- Item icon export (including animated APNG/WebP)
- In-game `/recipeflow sync` command
- Multi-version support: 1.7.10, 1.12.2, 1.19+

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete architecture design, including:
- Package structure and interfaces
- Data models matching the API types
- Provider priority system
- Multi-project Gradle build setup
- Version-specific implementations

## Development

This mod uses a separate Gradle-based build system (not part of the pnpm workspace).

### Project Structure

```
mod/
├── core/           # Shared code (Java 8)
├── forge-1.7.10/   # 1.7.10 mod (GTNH/NEI)
├── forge-1.12.2/   # 1.12.2 mod (JEI)
└── forge-1.19/     # 1.19+ mod (EMI/JEI)
```

### Building

```bash
# Build all versions
./gradlew build

# Build specific version
./gradlew :forge-1.19:build
```

## Configuration

After installing, configure in `config/recipeflow.toml`:

```toml
[server]
url = "https://your-recipeflow-server.com"
authToken = "your-auth-token"
modpackSlug = "your-modpack-slug"
```

## Usage

In-game, run:
```
/recipeflow sync
```

This extracts all recipes and uploads them to your RecipeFlow server.
