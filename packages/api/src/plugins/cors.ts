import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: env.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
};

export default fp(corsPlugin, {
  name: "cors",
});
