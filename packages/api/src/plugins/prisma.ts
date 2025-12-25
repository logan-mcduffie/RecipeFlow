import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db/client.js";

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Use type assertion to avoid PrismaClient type conflicts between different Prisma versions
  fastify.decorate("prisma", prisma as unknown as typeof fastify.prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: "prisma",
});
