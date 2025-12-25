import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import cookie from "@fastify/cookie";
import { env } from "../config/env.js";

const cookiePlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cookie, {
    secret: env.cookieSecret,
    parseOptions: {},
  });
};

export default fp(cookiePlugin, {
  name: "cookie",
});
