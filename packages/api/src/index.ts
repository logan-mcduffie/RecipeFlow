import { VERSION } from "@recipeflow/shared";
import { buildServer } from "./server.js";
import { env } from "./config/env.js";

// Import plugins
import prismaPlugin from "./plugins/prisma.js";
import corsPlugin from "./plugins/cors.js";
import cookiePlugin from "./plugins/cookie.js";
import jwtPlugin from "./plugins/jwt.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import compressPlugin from "./plugins/compress.js";
import staticPlugin from "./plugins/static.js";

// Import routes
import routes from "./routes/index.js";

// Import utilities
import { startCleanupScheduler, stopCleanupScheduler } from "./utils/cleanup.js";

async function main() {
  const server = buildServer();

  // Register plugins in order
  await server.register(prismaPlugin);
  await server.register(corsPlugin);
  await server.register(cookiePlugin);
  await server.register(jwtPlugin);
  await server.register(rateLimitPlugin);
  await server.register(errorHandlerPlugin);
  await server.register(compressPlugin);
  await server.register(staticPlugin);

  // Register routes
  await server.register(routes);

  // Start cleanup scheduler for upload sessions
  startCleanupScheduler(server);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    stopCleanupScheduler(server);
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Start server
  try {
    await server.listen({ port: env.port, host: "0.0.0.0" });
    server.log.info(`RecipeFlow API v${VERSION} running on port ${env.port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

main();
