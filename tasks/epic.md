# RecipeFlow Epic

**Project**: RecipeFlow
**Repository**: https://github.com/logan-mcduffie/RecipeFlow

## Summary

Build a web application for creating, sharing, and exploring GregTech recipe flowcharts with automatic recipe import from game.

## Why This Matters

NEI/EMI's built-in recipe visualization doesn't handle complex multi-step GregTech processing chains well. This tool provides a dedicated flowchart editor with throughput calculations, voltage tier awareness, and community sharing - specifically designed for complex modpacks like Star Technology.

## Scope

### v1 Features
- Companion mod for recipe extraction (Forge multi-version: 1.7.10, 1.12.2, 1.19+)
- Multi-modpack support with version tracking
- Hybrid flowchart editor (auto-generate + manual editing)
- GregTech features: voltage, overclocking, parallels, fluids
- Throughput calculations (items/sec/min/hour)
- OAuth authentication (Discord/GitHub/Google)
- Community flowchart sharing per modpack
- Animated item icons (APNG/WebP export from game)

### Out of Scope (v2+)
- Mobile app
- Real-time collaborative editing
- Recipe change diffing between pack versions
- Mod-side flowchart viewer
- API for third-party integrations

## Tech Stack

- **Frontend**: React + TypeScript + React Flow
- **Backend**: Node.js + Fastify/Express
- **Database**: PostgreSQL + Prisma
- **Auth**: OAuth (Discord, GitHub, Google)
- **Companion Mod**: Forge (Java, multi-version)

## Phases

| Phase | Focus | Tasks |
|-------|-------|-------|
| 1 | Project Setup & Infrastructure | 3 |
| 2 | Companion Mod Development | 4 |
| 3 | Recipe Management API | 2 |
| 4 | Flowchart Editor Frontend | 6 |
| 5 | GregTech Calculations | 3 |
| 6 | Flowchart Persistence & Sharing | 3 |
| 7 | Modpack Management | 2 |
| 8 | Polish & Deployment | 4 |

**Total**: 27 tasks
