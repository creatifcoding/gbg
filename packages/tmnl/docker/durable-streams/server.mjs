#!/usr/bin/env node
/**
 * TMNL Durable Streams Server
 *
 * Persistent stream primitive for reliable, resumable data streaming.
 * Provides HTTP API for offset-based replay and live tailing.
 *
 * Environment variables:
 *   PORT              - Server port (default: 3030)
 *   HOST              - Bind address (default: 0.0.0.0)
 *   DATA_DIR          - Persistence directory (default: /data)
 *   LONG_POLL_TIMEOUT - Long-poll timeout in ms (default: 30000)
 */

import { DurableStreamTestServer } from '@durable-streams/server';

const config = {
  port: parseInt(process.env.PORT || '3030', 10),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || '/data',
  longPollTimeout: parseInt(process.env.LONG_POLL_TIMEOUT || '30000', 10),
};

console.log('[durable-streams] Starting server with config:', config);

// Create server with file-backed persistence
const server = new DurableStreamTestServer({
  port: config.port,
  host: config.host,
  dataDir: config.dataDir,
  longPollTimeout: config.longPollTimeout,
});

await server.start();

console.log(`[durable-streams] Server listening on http://${config.host}:${config.port}`);
console.log(`[durable-streams] Data directory: ${config.dataDir}`);

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`[durable-streams] Received ${signal}, shutting down...`);
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
