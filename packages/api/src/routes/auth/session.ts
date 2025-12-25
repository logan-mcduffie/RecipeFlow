import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import {
  generateTokens,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from "../../services/auth.service.js";

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current user
  fastify.get(
    "/me",
    {
      preHandler: requireAuth,
    },
    async (request) => {
      // After requireAuth, authenticatedUser is guaranteed to be set
      const user = request.authenticatedUser!;
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
      };
    },
  );

  // Refresh tokens
  fastify.post(
    "/refresh",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const refreshToken = request.cookies.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({
          error: {
            code: "NO_REFRESH_TOKEN",
            message: "Refresh token not found",
          },
        });
      }

      try {
        // Verify refresh token
        const payload = fastify.jwt.verify<{ sub: string; username: string }>(refreshToken);

        // Find user
        const user = await fastify.prisma.user.findUnique({
          where: { id: payload.sub },
        });

        if (!user) {
          return reply.status(401).send({
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
          });
        }

        // Generate new tokens
        const tokens = generateTokens(fastify, user);

        // Set new cookies
        reply.setCookie(
          "accessToken",
          tokens.accessToken,
          getAccessCookieOptions(env.isProduction),
        );
        reply.setCookie(
          "refreshToken",
          tokens.refreshToken,
          getRefreshCookieOptions(env.isProduction),
        );

        return { success: true };
      } catch {
        // Clear invalid cookies
        reply.clearCookie("accessToken", { path: "/" });
        reply.clearCookie("refreshToken", { path: "/" });

        return reply.status(401).send({
          error: {
            code: "INVALID_REFRESH_TOKEN",
            message: "Invalid or expired refresh token",
          },
        });
      }
    },
  );

  // Logout
  fastify.post("/logout", async (_request, reply) => {
    reply.clearCookie("accessToken", { path: "/" });
    reply.clearCookie("refreshToken", { path: "/" });

    return { success: true };
  });
};

export default sessionRoutes;
