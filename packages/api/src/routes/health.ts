import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check
  fastify.get(
    "/health",
    {
      config: {
        rateLimit: false,
      },
    },
    async () => {
      return { status: "ok" };
    },
  );

  // Readiness check (includes database)
  fastify.get(
    "/health/ready",
    {
      config: {
        rateLimit: false,
      },
    },
    async (request, reply) => {
      try {
        // Test database connection
        await fastify.prisma.$queryRaw`SELECT 1`;

        return {
          status: "ok",
          database: "connected",
        };
      } catch (error) {
        request.log.error(error, "Database health check failed");
        return reply.status(503).send({
          status: "error",
          database: "disconnected",
        });
      }
    },
  );
};

export default healthRoutes;
