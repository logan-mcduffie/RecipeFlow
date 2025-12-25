import type { FastifyPluginAsync } from "fastify";
import healthRoutes from "./health.js";
import authRoutes from "./auth/index.js";
import modpackRoutes from "./modpacks/index.js";

const routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(modpackRoutes, { prefix: "/modpacks" });
};

export default routes;
