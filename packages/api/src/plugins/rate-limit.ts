import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    }),
  });
};

export default fp(rateLimitPlugin, {
  name: "rate-limit",
});
