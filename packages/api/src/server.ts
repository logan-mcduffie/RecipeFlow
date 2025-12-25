import Fastify from "fastify";
import { env } from "./config/env.js";

export function buildServer() {
  const server = Fastify({
    logger: {
      level: env.isDevelopment ? "debug" : "info",
      transport: env.isDevelopment
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    },
    trustProxy: env.isProduction,
  });

  return server;
}

export type FastifyServer = ReturnType<typeof buildServer>;
