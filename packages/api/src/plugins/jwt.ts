import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import jwt from "@fastify/jwt";
import { env } from "../config/env.js";

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: env.jwtSecret,
    cookie: {
      cookieName: "accessToken",
      signed: false,
    },
  });
};

export default fp(jwtPlugin, {
  name: "jwt",
  dependencies: ["cookie"],
});
