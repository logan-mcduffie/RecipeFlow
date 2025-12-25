import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import type { JwtPayload, AuthenticatedUser } from "../types/fastify.js";

export interface DiscordProfile {
  id: string;
  username: string;
  avatar: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function findOrCreateUser(
  fastify: FastifyInstance,
  provider: "DISCORD",
  oauthId: string,
  profile: { username: string; avatar: string | null },
): Promise<AuthenticatedUser> {
  const user = await fastify.prisma.user.upsert({
    where: {
      oauthProvider_oauthId: {
        oauthProvider: provider,
        oauthId,
      },
    },
    update: {
      username: profile.username,
      avatar: profile.avatar,
    },
    create: {
      oauthProvider: provider,
      oauthId,
      username: profile.username,
      avatar: profile.avatar,
    },
  });

  return user as AuthenticatedUser;
}

export function generateTokens(
  fastify: FastifyInstance,
  user: { id: string; username: string },
): TokenPair {
  const payload: JwtPayload = {
    sub: user.id,
    username: user.username,
  };

  const accessToken = fastify.jwt.sign(payload, {
    expiresIn: env.jwtAccessExpiry,
  });

  const refreshToken = fastify.jwt.sign(payload, {
    expiresIn: env.jwtRefreshExpiry,
  });

  return { accessToken, refreshToken };
}

export function getCookieOptions(isProduction: boolean) {
  return {
    path: "/",
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax" as const,
    domain: env.cookieDomain,
  };
}

export function getAccessCookieOptions(isProduction: boolean) {
  return {
    ...getCookieOptions(isProduction),
    maxAge: 15 * 60, // 15 minutes in seconds
  };
}

export function getRefreshCookieOptions(isProduction: boolean) {
  return {
    ...getCookieOptions(isProduction),
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}
