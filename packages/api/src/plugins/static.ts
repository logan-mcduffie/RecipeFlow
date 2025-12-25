/**
 * Static file serving plugin for icons
 *
 * Serves icon files from the configured ICON_DIR directory.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve } from "path";
import { mkdir } from "fs/promises";
import { env } from "../config/env.js";

const staticPlugin: FastifyPluginAsync = async (fastify) => {
  // Ensure icon directory exists
  const iconDir = resolve(process.cwd(), env.iconDir);
  await mkdir(iconDir, { recursive: true });

  // Serve static files from icon directory
  await fastify.register(fastifyStatic, {
    root: iconDir,
    prefix: env.iconBaseUrl,
    decorateReply: false,
    // Cache control for production
    cacheControl: env.isProduction,
    maxAge: env.isProduction ? "1d" : 0,
    // Set appropriate headers
    setHeaders: (res, _path) => {
      // Set CORS headers for icons
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Set cache headers based on environment
      if (env.isProduction) {
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  });

  fastify.log.info({ iconDir, prefix: env.iconBaseUrl }, "Static file serving configured");
};

export default fp(staticPlugin, {
  name: "static",
  dependencies: [],
});
