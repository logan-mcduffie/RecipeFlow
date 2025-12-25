import type { FastifyPluginAsync } from "fastify";
import discordRoutes from "./discord.js";
import sessionRoutes from "./session.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(discordRoutes);
  await fastify.register(sessionRoutes);
};

export default authRoutes;
