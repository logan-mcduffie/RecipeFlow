/**
 * Compression plugin
 *
 * Handles GZIP compression for requests and responses.
 * - Automatically decompresses incoming GZIP-encoded request bodies
 * - Compresses responses when client accepts gzip
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import fastifyCompress from "@fastify/compress";

const compressPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyCompress, {
    // Enable response compression
    global: true,

    // Compression threshold (don't compress small responses)
    threshold: 1024, // 1KB

    // Compression options
    encodings: ["gzip", "deflate"],

    // Request decompression is handled automatically by Fastify
    // when Content-Encoding header is present
  });

  fastify.log.info("Compression plugin configured");
};

export default fp(compressPlugin, {
  name: "compress",
  dependencies: [],
});
