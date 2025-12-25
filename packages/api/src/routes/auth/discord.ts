import type { FastifyPluginAsync } from "fastify";
import { env } from "../../config/env.js";
import {
  findOrCreateUser,
  generateTokens,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  type DiscordProfile,
} from "../../services/auth.service.js";

const DISCORD_API = {
  authorize: "https://discord.com/api/oauth2/authorize",
  token: "https://discord.com/api/oauth2/token",
  userInfo: "https://discord.com/api/users/@me",
};

const discordRoutes: FastifyPluginAsync = async (fastify) => {
  // Initiate Discord OAuth flow
  fastify.get(
    "/discord",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const state = crypto.randomUUID();

      // Store state in a short-lived cookie for CSRF protection
      reply.setCookie("oauth_state", state, {
        path: "/",
        httpOnly: true,
        secure: env.isProduction,
        sameSite: "lax",
        maxAge: 300, // 5 minutes
      });

      const params = new URLSearchParams({
        client_id: env.discordClientId,
        redirect_uri: env.discordRedirectUri,
        response_type: "code",
        scope: "identify",
        state,
      });

      return reply.redirect(`${DISCORD_API.authorize}?${params.toString()}`);
    },
  );

  // Handle Discord OAuth callback
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    "/discord/callback",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query;

      // Handle OAuth errors
      if (error) {
        request.log.warn({ error }, "Discord OAuth error");
        return reply.redirect(`${env.frontendUrl}/login?error=oauth_denied`);
      }

      if (!code || !state) {
        return reply.redirect(`${env.frontendUrl}/login?error=invalid_request`);
      }

      // Verify state
      const storedState = request.cookies.oauth_state;
      if (!storedState || storedState !== state) {
        return reply.redirect(`${env.frontendUrl}/login?error=invalid_state`);
      }

      // Clear state cookie
      reply.clearCookie("oauth_state", { path: "/" });

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(DISCORD_API.token, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: env.discordClientId,
            client_secret: env.discordClientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: env.discordRedirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          request.log.error(
            { status: tokenResponse.status, body: errorData },
            "Discord token exchange failed",
          );
          return reply.redirect(`${env.frontendUrl}/login?error=token_exchange_failed`);
        }

        const tokenData = (await tokenResponse.json()) as {
          access_token: string;
          token_type: string;
        };

        // Fetch user profile
        const userResponse = await fetch(DISCORD_API.userInfo, {
          headers: {
            Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
          },
        });

        if (!userResponse.ok) {
          request.log.error({ status: userResponse.status }, "Discord user info fetch failed");
          return reply.redirect(`${env.frontendUrl}/login?error=user_info_failed`);
        }

        const discordUser = (await userResponse.json()) as DiscordProfile;

        // Build avatar URL
        const avatarUrl = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null;

        // Create or update user
        const user = await findOrCreateUser(fastify, "DISCORD", discordUser.id, {
          username: discordUser.username,
          avatar: avatarUrl,
        });

        // Generate JWT tokens
        const tokens = generateTokens(fastify, user);

        // Set cookies
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

        // Redirect to frontend
        return reply.redirect(`${env.frontendUrl}/`);
      } catch (error) {
        request.log.error(error, "Discord OAuth callback error");
        return reply.redirect(`${env.frontendUrl}/login?error=server_error`);
      }
    },
  );
};

export default discordRoutes;
