import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthenticatedUser } from "../types/fastify.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();

    // After jwtVerify, request.user contains the JWT payload
    const payload = request.user;
    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "User not found",
        },
      });
      return;
    }

    // Store the full user in authenticatedUser
    request.authenticatedUser = user as AuthenticatedUser;
  } catch {
    reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();

    const payload = request.user;
    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (user) {
      request.authenticatedUser = user as AuthenticatedUser;
    }
  } catch {
    // Silently ignore - authenticatedUser remains undefined
  }
}
