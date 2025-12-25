import { config } from "dotenv";
import { resolve } from "path";

// Load .env from the monorepo root
config({ path: resolve(import.meta.dirname, "../../../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const env = {
  // Server
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: parseInt(optionalEnv("PORT", "3001"), 10),
  apiUrl: optionalEnv("API_URL", "http://localhost:3001"),
  frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:5173"),

  // Database
  databaseUrl: requireEnv("DATABASE_URL"),

  // JWT
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtAccessExpiry: optionalEnv("JWT_ACCESS_EXPIRY", "15m"),
  jwtRefreshExpiry: optionalEnv("JWT_REFRESH_EXPIRY", "7d"),

  // Cookies
  cookieSecret: requireEnv("COOKIE_SECRET"),
  cookieDomain: optionalEnv("COOKIE_DOMAIN", "localhost"),

  // Discord OAuth
  discordClientId: requireEnv("DISCORD_CLIENT_ID"),
  discordClientSecret: requireEnv("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: optionalEnv(
    "DISCORD_REDIRECT_URI",
    "http://localhost:3001/auth/discord/callback",
  ),

  // Upload & Storage
  uploadDir: optionalEnv("UPLOAD_DIR", "./uploads"),
  iconDir: optionalEnv("ICON_DIR", "./uploads/icons"),
  iconBaseUrl: optionalEnv("ICON_BASE_URL", "/icons"),
  maxUploadSize: parseInt(optionalEnv("MAX_UPLOAD_SIZE", "209715200"), 10), // 200MB default

  // External APIs (optional - for manifest verification)
  curseforgeApiKey: process.env.CURSEFORGE_API_KEY ?? null,
  modrinthApiUrl: optionalEnv("MODRINTH_API_URL", "https://api.modrinth.com/v2"),

  // Computed
  get isDevelopment() {
    return this.nodeEnv === "development";
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
} as const;
