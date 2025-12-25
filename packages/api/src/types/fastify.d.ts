import type { PrismaClient } from "@prisma/client";

export interface JwtPayload {
  sub: string; // User ID
  username: string;
}

export interface AuthenticatedUser {
  id: string;
  oauthProvider: "DISCORD";
  oauthId: string;
  username: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    // Set by auth middleware after looking up user in database
    authenticatedUser?: AuthenticatedUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
