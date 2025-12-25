import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyError } from "fastify";
import { env } from "../config/env.js";

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    // Log the error
    if (statusCode >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(error);
    }

    // Build error response
    const response: ApiError = {
      error: {
        code: error.code ?? "INTERNAL_ERROR",
        message:
          statusCode >= 500 && env.isProduction ? "An unexpected error occurred" : error.message,
      },
    };

    // Include validation details in development
    if (error.validation && !env.isProduction) {
      response.error.details = error.validation;
    }

    reply.status(statusCode).send(response);
  });

  // Handle 404s
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });
};

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
