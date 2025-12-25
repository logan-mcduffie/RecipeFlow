# RecipeFlow - Project Plan

**Repository**: https://github.com/logan-mcduffie/RecipeFlow

## Project Overview

A web-based flowchart tool for visualizing and planning Minecraft modpack recipe chains, with a focus on GregTech complexity. Features a companion Forge mod for automatic recipe extraction.

### Tech Stack
- **Frontend**: React + TypeScript + React Flow (node-based editor)
- **Backend**: Node.js + Express/Fastify
- **Database**: PostgreSQL (relational + JSONB for recipe data)
- **Auth**: OAuth (Discord/GitHub/Google)
- **Companion Mod**: Forge (multi-version: 1.7.10, 1.12.2, 1.19+)

### Core Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  Minecraft +    │     │           Web Application            │
│  Companion Mod  │────▶│  ┌─────────┐  ┌─────────────────┐   │
│                 │     │  │ API     │  │ React Frontend  │   │
│  /recipeflow    │     │  │ Server  │  │ + React Flow    │   │
│  sync command   │     │  └────┬────┘  └────────┬────────┘   │
└─────────────────┘     │       │                │            │
                        │  ┌────▼────────────────▼────┐       │
                        │  │      PostgreSQL          │       │
                        │  │  - Users (OAuth)         │       │
                        │  │  - Modpack Repos         │       │
                        │  │  - Recipes (JSONB)       │       │
                        │  │  - Flowcharts + version  │       │
                        │  └──────────────────────────┘       │
                        └──────────────────────────────────────┘
```

### Data Model: Modpack Repos

Each modpack functions like a "repository":
- **Modpack Repo**: Star Technology, GT:NH, etc. - the container
- **Versions**: 1.0.0, 1.0.1, 1.1.0 - recipe snapshots per version
- **Flowcharts**: User submissions tagged with the version they were made for
- **Filtering**: Browse all flowcharts or filter by specific pack version

The companion mod auto-detects pack version when syncing recipes.

---

## Why This Matters

NEI/EMI's built-in recipe visualization doesn't handle complex multi-step GregTech processing chains well. This tool provides a dedicated flowchart editor with throughput calculations, voltage tier awareness, and community sharing - specifically designed for complex modpacks like Star Technology.

---

## v1 Scope

- Companion mod for recipe extraction (multi-version Forge)
- Multi-modpack support with version tracking
- Hybrid flowchart editor (auto-generate + manual editing)
- GregTech features: voltage, overclocking, parallels, fluids
- Throughput calculations (items/sec/min/hour)
- OAuth authentication (Discord/GitHub/Google)
- Community flowchart sharing per modpack
- Animated item icon support (APNG/WebP)

## Out of Scope (v2+)

- Mobile app
- Real-time collaborative editing
- Recipe change diffing between pack versions
- Mod-side flowchart viewer
- API for third-party integrations

---

## Phase Overview

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 3 | Project setup, DB, API foundation |
| 2 | 4 | Forge companion mod (multi-version) |
| 3 | 2 | Recipe import/query API |
| 4 | 6 | React Flow editor |
| 5 | 3 | GregTech calculations |
| 6 | 3 | Save/share/export |
| 7 | 2 | Modpack directory |
| 8 | 4 | Polish & deployment |

**Total: 27 tasks**

---

## MVP Priority Order

1. Phase 1 (foundation)
2. Phase 4.1-4.4 (basic editor)
3. Phase 2 (mod)
4. Phase 3 (recipe API)
5. Phase 4.5-4.6 (recipe browser + auto-gen)
6. Phase 5 (GT calculations)
7. Phase 6.1 (save/load)
8. Phase 8.3 (deployment)
9. Everything else (community, polish)

---

## Task Index

See `/tasks/` directory for individual task files:

### Phase 1: Project Setup & Infrastructure
- [1.1 - Initialize Monorepo Structure](tasks/1.1-initialize-monorepo.md)
- [1.2 - Database Schema Design](tasks/1.2-database-schema.md)
- [1.3 - API Server Foundation](tasks/1.3-api-server.md)

### Phase 2: Companion Mod Development
- [2.1 - Mod Architecture Design](tasks/2.1-mod-architecture.md)
- [2.2 - Recipe Extractor (1.19+)](tasks/2.2-recipe-extractor.md)
- [2.3 - Item Icon Export System](tasks/2.3-icon-export.md)
- [2.4 - Recipe Export Command](tasks/2.4-export-command.md)

### Phase 3: Recipe Management API
- [3.1 - Recipe Import Endpoint](tasks/3.1-recipe-import.md)
- [3.2 - Recipe Query API](tasks/3.2-recipe-query.md)

### Phase 4: Flowchart Editor Frontend
- [4.1 - React App Setup](tasks/4.1-react-setup.md)
- [4.2 - Authentication Flow](tasks/4.2-auth-flow.md)
- [4.3 - React Flow Integration](tasks/4.3-react-flow.md)
- [4.4 - Recipe Node Component](tasks/4.4-recipe-node.md)
- [4.5 - Recipe Browser Panel](tasks/4.5-recipe-browser.md)
- [4.6 - Auto-Generate Flowchart](tasks/4.6-auto-generate.md)

### Phase 5: GregTech Calculations
- [5.1 - Throughput Calculator](tasks/5.1-throughput-calc.md)
- [5.2 - Machine Configuration Panel](tasks/5.2-machine-config.md)
- [5.3 - Bottleneck Analysis](tasks/5.3-bottleneck.md)

### Phase 6: Flowchart Persistence & Sharing
- [6.1 - Save/Load Flowcharts](tasks/6.1-save-load.md)
- [6.2 - Community Sharing](tasks/6.2-community-sharing.md)
- [6.3 - Export Features](tasks/6.3-export.md)

### Phase 7: Modpack Management
- [7.1 - Modpack Directory](tasks/7.1-modpack-directory.md)
- [7.2 - Modpack Detail Page](tasks/7.2-modpack-detail.md)

### Phase 8: Polish & Deployment
- [8.1 - Recipe Display Toggles](tasks/8.1-display-toggles.md)
- [8.2 - Resource Totals Summary](tasks/8.2-resource-totals.md)
- [8.3 - Deployment Configuration](tasks/8.3-deployment.md)
- [8.4 - Documentation](tasks/8.4-documentation.md)
