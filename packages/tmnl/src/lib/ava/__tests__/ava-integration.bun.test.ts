/**
 * AVA Live Integration Tests
 *
 * Tests HTTP and WebSocket clients against a RUNNING ava-api server.
 * These tests require `ava-api` to be running on localhost:3000.
 *
 * Run with: bun test src/lib/ava/__tests__/ava-integration.bun.test.ts
 *
 * Skip condition: Set AVA_SKIP_INTEGRATION=1 to skip these tests in CI
 * or when no server is available.
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { Effect, Stream, Layer, Duration, Cause } from 'effect';
import { BunSocket } from '@effect/platform-bun';

import {
  AvaHttpClient,
  AvaHttpClientLive,
  AvaApiConfig,
  AvaSessionClient,
  AvaSessionClientLive,
  type SessionEvent,
} from '../index';

// =============================================================================
// Test Configuration
// =============================================================================

const AVA_BASE_URL = process.env.AVA_BASE_URL ?? 'http://localhost:3000';
const SKIP_INTEGRATION = process.env.AVA_SKIP_INTEGRATION === '1';

// Shared config layer for all tests
const testConfigLayer = Layer.succeed(AvaApiConfig, {
  baseUrl: AVA_BASE_URL,
  timeout: 10000,
});

// WebSocket constructor layer for Bun
const bunWebSocketLayer = BunSocket.layerWebSocketConstructor;

// Composed live layers
const httpClientLayer = AvaHttpClientLive.pipe(Layer.provide(testConfigLayer));
const sessionClientLayer = AvaSessionClientLive.pipe(
  Layer.provide(bunWebSocketLayer),
  Layer.provide(testConfigLayer)
);

// =============================================================================
// Health Check
// =============================================================================

let serverAvailable = false;

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AVA_BASE_URL}/api/v1/views`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

// =============================================================================
// HTTP Client Integration Tests
// =============================================================================

describe('AvaHttpClient Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      console.warn(`⚠️  AVA server not available at ${AVA_BASE_URL}. Tests will be skipped.`);
    }
  });

  it('listViews - fetches views from live server', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const views = yield* client.listViews();
      expect(Array.isArray(views)).toBe(true);
      if (views.length > 0) {
        expect(views[0]).toHaveProperty('id');
        expect(views[0]).toHaveProperty('name');
        expect(views[0]).toHaveProperty('version');
      }
      return views;
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('registerView - registers a new view', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const testViewId = `integration-test-${Date.now()}`;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const response = yield* client.registerView({
        id: testViewId,
        name: 'Integration Test View',
        assemblage_id: 'test-assemblage',
        channels: [
          {
            id: 'ch-test',
            role: 'State',
            source_connection: 'test://integration',
          },
        ],
      });

      expect(response.view_id).toBe(testViewId);
      expect(response.was_created).toBe(true);
      expect(response.version).toBeGreaterThanOrEqual(1);
      return response;
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('getSpec - retrieves spec for existing view', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const views = yield* client.listViews();

      if (views.length === 0) {
        yield* client.registerView({
          id: 'spec-test-view',
          name: 'Spec Test',
          assemblage_id: 'test',
          channels: [],
        });
      }

      const targetId = views[0]?.id ?? 'spec-test-view';
      const spec = yield* client.getSpec(targetId);

      expect(spec.id).toBe(targetId);
      expect(spec).toHaveProperty('name');
      expect(spec).toHaveProperty('assemblage_id');
      expect(spec).toHaveProperty('channels');
      expect(Array.isArray(spec.channels)).toBe(true);
      return spec;
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('getSpec - returns AvaNotFoundError for missing view', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const result = yield* client.getSpec('non-existent-view-12345').pipe(Effect.flip);
      expect(result._tag).toBe('AvaNotFoundError');
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('getStatus - retrieves status for existing view', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const views = yield* client.listViews();
      if (views.length === 0) return;

      const status = yield* client.getStatus(views[0].id);
      expect(status.view_id).toBe(views[0].id);
      expect(typeof status.is_subscribed).toBe('boolean');
      expect(typeof status.total_subscriptions).toBe('number');
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('invalidate - invalidates existing view', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const views = yield* client.listViews();
      if (views.length === 0) return;

      const response = yield* client.invalidate(views[0].id, {
        reason: 'Integration test invalidation',
      });

      expect(response.view_id).toBe(views[0].id);
      expect(response).toHaveProperty('message');
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('invalidate - returns AvaNotFoundError for missing view', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const result = yield* client.invalidate('non-existent-view-12345').pipe(Effect.flip);
      expect(result._tag).toBe('AvaNotFoundError');
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });
});

// =============================================================================
// WebSocket Session Integration Tests
// =============================================================================

describe('AvaSessionClient Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      console.warn(`⚠️  AVA server not available at ${AVA_BASE_URL}. WebSocket tests will be skipped.`);
    }
  });

  it('connection - establishes WebSocket connection', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaSessionClient;

      yield* client.waitForConnection.pipe(
        Effect.timeout(Duration.seconds(5)),
        Effect.catchTag('TimeoutException', () => Effect.fail(new Error('Connection timeout')))
      );

      const connected = yield* client.isConnected;
      expect(connected).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

    await Effect.runPromise(program);
  });

  it('ping/pong - receives pong response', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaSessionClient;
      yield* client.waitForConnection;

      yield* client.ping('integration-test-ping');

      const event = yield* client.events.pipe(
        Stream.filter((e): e is SessionEvent & { _tag: 'pong' } => e._tag === 'pong'),
        Stream.take(1),
        Stream.runHead,
        Effect.timeout(Duration.seconds(5)),
        Effect.flatMap((maybeEvent) =>
          maybeEvent._tag === 'Some'
            ? Effect.succeed(maybeEvent.value)
            : Effect.fail(new Error('No pong received'))
        )
      );

      expect(event._tag).toBe('pong');
      expect(event.payload).toBe('integration-test-ping');
    }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

    await Effect.runPromise(program);
  });

  it('subscribe - subscribes to view and receives artifact', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const combinedLayer = Layer.mergeAll(httpClientLayer, sessionClientLayer);

    const program = Effect.gen(function* () {
      const httpClient = yield* AvaHttpClient;
      const views = yield* httpClient.listViews();

      if (views.length === 0) {
        yield* httpClient.registerView({
          id: 'ws-test-view',
          name: 'WebSocket Test View',
          assemblage_id: 'test',
          channels: [],
        });
      }

      const targetViewId = views[0]?.id ?? 'ws-test-view';

      const sessionClient = yield* AvaSessionClient;
      yield* sessionClient.waitForConnection;

      yield* sessionClient.subscribe(targetViewId);

      const event = yield* sessionClient.events.pipe(
        Stream.filter((e): e is SessionEvent & { _tag: 'artifact' } => e._tag === 'artifact'),
        Stream.take(1),
        Stream.runHead,
        Effect.timeout(Duration.seconds(10)),
        Effect.flatMap((maybeEvent) =>
          maybeEvent._tag === 'Some'
            ? Effect.succeed(maybeEvent.value)
            : Effect.fail(new Error('No artifact received'))
        )
      );

      expect(event._tag).toBe('artifact');
      expect(event.artifact.view_id).toBe(targetViewId);
    }).pipe(Effect.scoped, Effect.provide(combinedLayer));

    await Effect.runPromise(program);
  });

  it('artifacts stream - filters artifact events', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const combinedLayer = Layer.mergeAll(httpClientLayer, sessionClientLayer);

    const program = Effect.gen(function* () {
      const httpClient = yield* AvaHttpClient;
      const views = yield* httpClient.listViews();

      if (views.length === 0) return;

      const sessionClient = yield* AvaSessionClient;
      yield* sessionClient.waitForConnection;

      yield* sessionClient.subscribe(views[0].id);

      const artifact = yield* sessionClient.artifacts.pipe(
        Stream.take(1),
        Stream.runHead,
        Effect.timeout(Duration.seconds(10)),
        Effect.flatMap((maybeArtifact) =>
          maybeArtifact._tag === 'Some'
            ? Effect.succeed(maybeArtifact.value)
            : Effect.fail(new Error('No artifact from stream'))
        )
      );

      expect(artifact.view_id).toBe(views[0].id);
      expect(artifact).toHaveProperty('spec');
      expect(artifact).toHaveProperty('channel_bindings');
    }).pipe(Effect.scoped, Effect.provide(combinedLayer));

    await Effect.runPromise(program);
  });
});

// =============================================================================
// Error Scenario Tests
// =============================================================================

describe('Error Scenarios', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkServerHealth();
  });

  it('HTTP - handles 404 gracefully', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      const result = yield* Effect.either(client.getSpec('definitely-not-a-real-view-id'));

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('AvaNotFoundError');
      }
    }).pipe(Effect.provide(httpClientLayer));

    await Effect.runPromise(program);
  });

  it('HTTP - handles server unavailable', async () => {
    if (SKIP_INTEGRATION) return;

    const badConfig = Layer.succeed(AvaApiConfig, {
      baseUrl: 'http://localhost:59999',
      timeout: 2000,
    });

    const badClient = AvaHttpClientLive.pipe(Layer.provide(badConfig));

    const program = Effect.gen(function* () {
      const client = yield* AvaHttpClient;
      return yield* client.listViews();
    }).pipe(Effect.provide(badClient));

    const result = await Effect.runPromise(Effect.either(program));
    expect(result._tag).toBe('Left');
  });
});
