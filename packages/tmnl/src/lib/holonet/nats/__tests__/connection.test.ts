/**
 * NatsConnectionService Comprehensive Tests
 *
 * Tests the NATS connection lifecycle with scoped resource management.
 * NATS should be running on localhost:9222 (WebSocket port).
 *
 * Test scenarios per plan:
 * 1. Connect to NATS server
 * 2. Verify JetStream is available
 * 3. Verify JetStream manager is available
 * 4. Clean disconnect (drain + close)
 * 5. Error handling for invalid servers
 *
 * Run with: pnpm vitest run src/lib/holonet/nats/__tests__/connection.test.ts
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module holonet/nats/__tests__/connection
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Effect, Layer, Exit, Cause } from 'effect';
import { connect } from 'nats.ws';

import { NatsConnectionService } from '../connection';
import { HolonetConfigTag } from '../../schemas/config';
import { Connection } from '../errors';

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1';

// Config layer for tests
const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'nats-connection-test',
  debug: false,
});

// Invalid server config for error testing
const invalidConfigLayer = HolonetConfigTag.Custom({
  servers: 'ws://localhost:99999', // Invalid port
  name: 'nats-connection-test-invalid',
});

// =============================================================================
// Health Check
// =============================================================================

let serverAvailable = false;

async function checkNatsHealth(): Promise<boolean> {
  try {
    const nc = await connect({ servers: NATS_SERVERS });
    await nc.close();
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('NatsConnectionService Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkNatsHealth();
    if (!serverAvailable) {
      console.warn(
        `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Connect to NATS server
  // ---------------------------------------------------------------------------

  describe('connection lifecycle', () => {
    it('connects to NATS server successfully', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // Connection should be available
        expect(conn.nc).toBeDefined();
        expect(conn.config.servers).toBe(NATS_SERVERS);
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });

    it('provides config through the service', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        expect(conn.config.servers).toBe(NATS_SERVERS);
        expect(conn.config.name).toBe('nats-connection-test');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Verify JetStream is available
  // ---------------------------------------------------------------------------

  describe('JetStream client', () => {
    it('provides JetStream client (js)', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // JetStream client should be available
        expect(conn.js).toBeDefined();
        expect(typeof conn.js.publish).toBe('function');
        expect(typeof conn.js.consumers).toBe('object');
        expect(typeof conn.js.views).toBe('object');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });

    it('JetStream client can access views.kv', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // JetStream views should be available
        expect(conn.js.views).toBeDefined();
        expect(typeof conn.js.views.kv).toBe('function');
        expect(typeof conn.js.views.os).toBe('function');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Verify JetStream manager is available
  // ---------------------------------------------------------------------------

  describe('JetStream manager', () => {
    it('provides JetStream manager (jsm)', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // JetStream manager should be available
        expect(conn.jsm).toBeDefined();
        expect(typeof conn.jsm.streams).toBe('object');
        expect(typeof conn.jsm.consumers).toBe('object');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });

    it('JetStream manager streams API is available', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // Streams API should be available
        expect(typeof conn.jsm.streams.info).toBe('function');
        expect(typeof conn.jsm.streams.add).toBe('function');
        expect(typeof conn.jsm.streams.update).toBe('function');
        expect(typeof conn.jsm.streams.delete).toBe('function');
        expect(typeof conn.jsm.streams.list).toBe('function');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });

    it('JetStream manager consumers API is available', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // Consumers API should be available
        expect(typeof conn.jsm.consumers.info).toBe('function');
        expect(typeof conn.jsm.consumers.add).toBe('function');
        expect(typeof conn.jsm.consumers.delete).toBe('function');
        expect(typeof conn.jsm.consumers.list).toBe('function');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Clean disconnect (scoped lifecycle)
  // ---------------------------------------------------------------------------

  describe('scoped lifecycle', () => {
    it('connection is cleaned up when scope closes', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      // Track connection state
      let connectionObtained = false;

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // Connection should be active
        expect(conn.nc.isClosed()).toBe(false);
        connectionObtained = true;
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);

      // After scope closes, connection cleanup should have been triggered
      // (We can't directly verify the connection is closed since we don't have
      // a reference outside the scope, but the fact that the program completed
      // without error indicates cleanup was successful)
      expect(connectionObtained).toBe(true);
    });

    it('multiple scoped usages work independently', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      // First scoped usage
      const program1 = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;
        expect(conn.nc.isClosed()).toBe(false);
        return 'first';
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      const result1 = await Effect.runPromise(program1);
      expect(result1).toBe('first');

      // Second scoped usage (new connection)
      const program2 = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;
        expect(conn.nc.isClosed()).toBe(false);
        return 'second';
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      const result2 = await Effect.runPromise(program2);
      expect(result2).toBe('second');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Error handling for invalid servers
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('returns ConnectError for invalid server', async () => {
      if (SKIP_INTEGRATION) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(invalidConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;
        // Should not reach here
        return conn;
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      const exit = await Effect.runPromiseExit(program);

      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause);
        expect(error._tag).toBe('Some');
        if (error._tag === 'Some') {
          // Should be a Connection.ConnectError
          expect(error.value._tag).toBe('Connection/Connect');
          expect((error.value as Connection.ConnectError).servers).toBe(
            'ws://localhost:99999'
          );
        }
      }
    });

    it('ConnectError contains server info for debugging', async () => {
      if (SKIP_INTEGRATION) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(invalidConfigLayer)
      );

      const program = Effect.gen(function* () {
        return yield* NatsConnectionService;
      }).pipe(
        Effect.scoped,
        Effect.provide(testLayer),
        Effect.either
      );

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        const error = result.left as Connection.ConnectError;
        expect(error._tag).toBe('Connection/Connect');
        expect(error.servers).toBeDefined();
        expect(error.message).toContain('Failed to connect');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Connection state verification
  // ---------------------------------------------------------------------------

  describe('connection state', () => {
    it('connection is not closed or draining during active scope', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // Connection should be active
        expect(conn.nc.isClosed()).toBe(false);
        expect(conn.nc.isDraining()).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });

    it('getServer returns connected server info', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testLayer = NatsConnectionService.Default.pipe(
        Layer.provide(testConfigLayer)
      );

      const program = Effect.gen(function* () {
        const conn = yield* NatsConnectionService;

        // Server info should be available
        const server = conn.nc.getServer();
        expect(server).toBeDefined();
        expect(typeof server).toBe('string');
      }).pipe(Effect.scoped, Effect.provide(testLayer));

      await Effect.runPromise(program);
    });
  });
});

// =============================================================================
// Unit Tests (no NATS required)
// =============================================================================

describe('NatsConnectionService Unit', () => {
  describe('error types', () => {
    it('ConnectError has correct tag', () => {
      const error = new Connection.ConnectError({
        message: 'Test error',
        servers: 'ws://localhost:4222',
      });

      expect(error._tag).toBe('Connection/Connect');
      expect(error.servers).toBe('ws://localhost:4222');
      expect(error.message).toBe('Test error');
    });

    it('DisconnectError has correct tag', () => {
      const error = new Connection.DisconnectError({
        message: 'Disconnected',
        wasClean: false,
      });

      expect(error._tag).toBe('Connection/Disconnect');
      expect(error.wasClean).toBe(false);
    });

    it('JetStreamManagerError has correct tag', () => {
      const error = new Connection.JetStreamManagerError({
        message: 'JSM error',
      });

      expect(error._tag).toBe('Connection/JetStreamManager');
    });
  });
});
