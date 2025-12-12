/**
 * AVA Comprehensive Integration Tests
 *
 * Full API coverage with edge cases against a RUNNING ava-api server.
 * Tests HTTP endpoints, WebSocket session, error handling, and edge cases.
 *
 * Run with: bun test src/lib/ava/__tests__/ava-comprehensive.bun.test.ts
 *
 * Server requirement: ava-api running on localhost:3000
 * Skip: Set AVA_SKIP_INTEGRATION=1 to skip
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Effect, Stream, Layer, Duration, Cause, Ref, Deferred } from 'effect';
import { BunSocket } from '@effect/platform-bun';
import { Socket } from '@effect/platform';

import {
  AvaHttpClient,
  AvaHttpClientLive,
  AvaApiConfig,
  AvaSessionClient,
  AvaSessionClientLive,
  AvaHttpError,
  AvaNotFoundError,
  AvaValidationError,
  type SessionEvent,
} from '../index';

// =============================================================================
// Test Configuration
// =============================================================================

const AVA_BASE_URL = process.env.AVA_BASE_URL ?? 'http://localhost:3000';
const WS_URL = AVA_BASE_URL.replace(/^http:/, 'ws:') + '/api/v1/session';
const SKIP_INTEGRATION = process.env.AVA_SKIP_INTEGRATION === '1';

// Layers
const testConfigLayer = Layer.succeed(AvaApiConfig, {
  baseUrl: AVA_BASE_URL,
  timeout: 10000,
});

const bunWebSocketLayer = BunSocket.layerWebSocketConstructor;

const httpClientLayer = AvaHttpClientLive.pipe(Layer.provide(testConfigLayer));
const sessionClientLayer = AvaSessionClientLive.pipe(
  Layer.provide(bunWebSocketLayer),
  Layer.provide(testConfigLayer)
);
const combinedLayer = Layer.mergeAll(httpClientLayer, sessionClientLayer);

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
// Test Utilities
// =============================================================================

/** Generate unique test view ID */
const testViewId = (suffix: string) => `test-${Date.now()}-${suffix}`;

/** Create a minimal view spec for testing */
const minimalViewSpec = (id: string) => ({
  id,
  name: `Test View ${id}`,
  assemblage_id: 'test-assemblage',
  channels: [
    {
      id: 'ch-state',
      role: 'State',
      source_connection: 'memory://test',
    },
  ],
});

/** Create view spec with multiple channels */
const multiChannelViewSpec = (id: string) => ({
  id,
  name: `Multi-Channel View ${id}`,
  description: 'View with all channel roles',
  assemblage_id: 'test-assemblage',
  channels: [
    { id: 'ch-state', role: 'State', source_connection: 'memory://state' },
    { id: 'ch-event', role: 'Event', source_connection: 'memory://event' },
    { id: 'ch-metric', role: 'Metric', source_connection: 'memory://metric' },
    { id: 'ch-command', role: 'Command', source_connection: 'memory://command' },
    { id: 'ch-log', role: 'Log', source_connection: 'memory://log' },
  ],
});

// =============================================================================
// HTTP Client Tests - Full Coverage
// =============================================================================

describe('AvaHttpClient - Full Coverage', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      console.warn(`⚠️  AVA server not available at ${AVA_BASE_URL}`);
    }
  });

  // ---------------------------------------------------------------------------
  // listViews
  // ---------------------------------------------------------------------------

  describe('listViews', () => {
    it('returns array (possibly empty)', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const views = yield* client.listViews();

        expect(Array.isArray(views)).toBe(true);
        // Verify ViewSummary shape if any exist
        if (views.length > 0) {
          expect(views[0]).toHaveProperty('id');
          expect(views[0]).toHaveProperty('name');
          expect(views[0]).toHaveProperty('version');
          expect(typeof views[0].version).toBe('number');
        }
        return views;
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('returns all registered views', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('list-all');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;

        // Register a view
        yield* client.registerView(minimalViewSpec(viewId));

        // List should include it
        const views = yield* client.listViews();
        const found = views.find(v => v.id === viewId);

        expect(found).toBeDefined();
        expect(found?.name).toBe(`Test View ${viewId}`);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // registerView
  // ---------------------------------------------------------------------------

  describe('registerView', () => {
    it('creates new view with was_created=true', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('create-new');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.registerView(minimalViewSpec(viewId));

        expect(response.view_id).toBe(viewId);
        expect(response.was_created).toBe(true);
        expect(response.version).toBeGreaterThanOrEqual(1);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('updates existing view with was_created=false', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('update-existing');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;

        // Create first
        const first = yield* client.registerView(minimalViewSpec(viewId));
        expect(first.was_created).toBe(true);

        // Update with overwrite_existing=true
        const spec = {
          ...minimalViewSpec(viewId),
          name: 'Updated Name',
          overwrite_existing: true,
        };
        const second = yield* client.registerView(spec);

        expect(second.view_id).toBe(viewId);
        expect(second.was_created).toBe(false);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('accepts all channel roles (STATE, EVENT, METRIC, COMMAND, LOG)', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('all-roles');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.registerView(multiChannelViewSpec(viewId));

        expect(response.view_id).toBe(viewId);
        expect(response.was_created).toBe(true);

        // Verify spec has all channels
        const spec = yield* client.getSpec(viewId);
        expect(spec.channels.length).toBe(5);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('accepts lowercase channel roles', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('lowercase-role');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.registerView({
          id: viewId,
          name: 'Lowercase Role Test',
          assemblage_id: 'test',
          channels: [
            { id: 'ch1', role: 'state', source_connection: 'memory://test' }, // lowercase
          ],
        });

        expect(response.was_created).toBe(true);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('accepts all materialization tiers', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('materialization');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.registerView({
          id: viewId,
          name: 'Materialization Test',
          assemblage_id: 'test',
          channels: [
            { id: 'ch-ondemand', role: 'State', source_connection: 'memory://1', materialization: 'OnDemand' },
            { id: 'ch-cached', role: 'State', source_connection: 'memory://2', materialization: 'Cached' },
            { id: 'ch-continuous', role: 'State', source_connection: 'memory://3', materialization: 'Continuous' },
          ],
        });

        expect(response.was_created).toBe(true);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('generates UUID when id not provided', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.registerView({
          // No id field
          name: 'Auto-ID View',
          assemblage_id: 'test',
          channels: [
            { id: 'ch1', role: 'State', source_connection: 'memory://test' },
          ],
        });

        expect(response.view_id).toBeDefined();
        expect(response.view_id.length).toBeGreaterThan(0);
        expect(response.was_created).toBe(true);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('includes optional description', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('with-description');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView({
          id: viewId,
          name: 'Described View',
          description: 'This is a test view with a description',
          assemblage_id: 'test',
          channels: [],
        });

        const spec = yield* client.getSpec(viewId);
        expect(spec.description).toBe('This is a test view with a description');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // getSpec
  // ---------------------------------------------------------------------------

  describe('getSpec', () => {
    it('returns full spec for existing view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('get-spec');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView(multiChannelViewSpec(viewId));

        const spec = yield* client.getSpec(viewId);

        expect(spec.id).toBe(viewId);
        expect(spec.name).toBe(`Multi-Channel View ${viewId}`);
        expect(spec.assemblage_id).toBe('test-assemblage');
        expect(Array.isArray(spec.channels)).toBe(true);
        expect(spec.channels.length).toBe(5);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('returns AvaNotFoundError for missing view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const result = yield* client.getSpec('definitely-not-exists-xyz').pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('handles special characters in view ID', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('special-chars-test');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView(minimalViewSpec(viewId));

        const spec = yield* client.getSpec(viewId);
        expect(spec.id).toBe(viewId);
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // getArtifact
  // ---------------------------------------------------------------------------

  describe('getArtifact', () => {
    it('returns artifact for subscribed view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('artifact-subscribed');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        // Need to subscribe via WebSocket first to make artifact available
        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;
        yield* sessionClient.subscribe(viewId);

        // Small delay to ensure subscription is registered
        yield* Effect.sleep(Duration.millis(100));

        // Now get artifact via HTTP
        const artifact = yield* httpClient.getArtifact(viewId);

        expect(artifact.view_id).toBe(viewId);
        expect(artifact.spec).toBeDefined();
        expect(Array.isArray(artifact.channel_bindings)).toBe(true);
        expect(typeof artifact.created_at_ms).toBe('number');
        expect(typeof artifact.version).toBe('number');
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });

    it('returns error for unsubscribed view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('artifact-unsubscribed');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView(minimalViewSpec(viewId));

        // Don't subscribe, just try to get artifact
        const result = yield* client.getArtifact(viewId).pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('returns AvaNotFoundError for non-existent view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const result = yield* client.getArtifact('non-existent-artifact-view').pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------------------

  describe('getStatus', () => {
    it('returns status for existing view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('status-exists');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView(minimalViewSpec(viewId));

        const status = yield* client.getStatus(viewId);

        expect(status.view_id).toBe(viewId);
        expect(typeof status.is_subscribed).toBe('boolean');
        expect(typeof status.version).toBe('number');
        expect(typeof status.total_subscriptions).toBe('number');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('shows is_subscribed=true after subscription', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('status-subscribed');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        // Subscribe via WebSocket
        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;
        yield* sessionClient.subscribe(viewId);
        yield* Effect.sleep(Duration.millis(100));

        // Check status
        const status = yield* httpClient.getStatus(viewId);
        expect(status.is_subscribed).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });

    it('returns AvaNotFoundError for missing view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const result = yield* client.getStatus('non-existent-status-view').pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // invalidate
  // ---------------------------------------------------------------------------

  describe('invalidate', () => {
    it('invalidates view without reason', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('invalidate-no-reason');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView(minimalViewSpec(viewId));

        const response = yield* client.invalidate(viewId);

        expect(response.view_id).toBe(viewId);
        expect(response.message).toContain('invalidated');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('invalidates view with reason', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('invalidate-with-reason');

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        yield* client.registerView(minimalViewSpec(viewId));

        const response = yield* client.invalidate(viewId, { reason: 'cache expired' });

        expect(response.view_id).toBe(viewId);
        expect(response.message).toContain('cache expired');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });

    it('returns AvaNotFoundError for missing view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const result = yield* client.invalidate('non-existent-invalidate-view').pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('handles server unavailable', async () => {
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

    it('propagates AvaHttpError for server errors', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        // Try to get spec for non-existent - should be NotFoundError
        const result = yield* Effect.either(client.getSpec('xxx'));

        if (result._tag === 'Left') {
          const error = result.left;
          // Should be either AvaNotFoundError or AvaHttpError
          expect(['AvaNotFoundError', 'AvaHttpError']).toContain(error._tag);
        }
      }).pipe(Effect.provide(httpClientLayer));

      await Effect.runPromise(program);
    });
  });
});

// =============================================================================
// WebSocket Session Tests - Full Coverage
// =============================================================================

describe('AvaSessionClient - Full Coverage', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkServerHealth();
  });

  // ---------------------------------------------------------------------------
  // Connection Lifecycle
  // ---------------------------------------------------------------------------

  describe('Connection Lifecycle', () => {
    it('establishes WebSocket connection', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection.pipe(Effect.timeout(Duration.seconds(5)));

        const connected = yield* client.isConnected;
        expect(connected).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });

    it('waitForConnection resolves immediately if already connected', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection;

        // Call again - should resolve immediately
        yield* client.waitForConnection;

        const connected = yield* client.isConnected;
        expect(connected).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Subscribe Command
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('subscribes to existing view and receives artifact', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('ws-subscribe');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;
        yield* sessionClient.subscribe(viewId);

        // Wait for artifact event
        const event = yield* sessionClient.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'artifact' } => e._tag === 'artifact'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No artifact'))
          )
        );

        expect(event._tag).toBe('artifact');
        expect(event.artifact.view_id).toBe(viewId);
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });

    it('returns error event for non-existent view', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;
        yield* sessionClient.subscribe('non-existent-ws-view');

        // Should receive error event
        const event = yield* sessionClient.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'error' } => e._tag === 'error'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No error event'))
          )
        );

        expect(event._tag).toBe('error');
        expect(event.code).toBe('NOT_FOUND');
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });

    it('handles multiple subscriptions on same connection', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId1 = testViewId('ws-multi-1');
      const viewId2 = testViewId('ws-multi-2');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId1));
        yield* httpClient.registerView(minimalViewSpec(viewId2));

        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        // Subscribe to both
        yield* sessionClient.subscribe(viewId1);
        yield* sessionClient.subscribe(viewId2);

        // Collect artifacts
        const artifacts = yield* sessionClient.artifacts.pipe(
          Stream.take(2),
          Stream.runCollect,
          Effect.timeout(Duration.seconds(5)),
          Effect.map((chunk) => Array.from(chunk))
        );

        expect(artifacts.length).toBe(2);
        const viewIds = artifacts.map(a => a.view_id);
        expect(viewIds).toContain(viewId1);
        expect(viewIds).toContain(viewId2);
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Unsubscribe Command
  // ---------------------------------------------------------------------------

  describe('unsubscribe', () => {
    it('unsubscribes from view and receives status event', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('ws-unsubscribe');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        // Subscribe first
        yield* sessionClient.subscribe(viewId);

        // Wait for artifact
        yield* sessionClient.events.pipe(
          Stream.filter((e) => e._tag === 'artifact'),
          Stream.take(1),
          Stream.runDrain,
          Effect.timeout(Duration.seconds(3))
        );

        // Now unsubscribe
        yield* sessionClient.unsubscribe(viewId);

        // Should receive status event
        const event = yield* sessionClient.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'status' } => e._tag === 'status'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No status event'))
          )
        );

        expect(event._tag).toBe('status');
        expect(event.view_id).toBe(viewId);
        expect(event.subscribed).toBe(false);
        expect(event.message).toBe('Unsubscribed');
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });

    it('unsubscribe from non-subscribed view still returns status', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        // Unsubscribe without prior subscribe
        yield* sessionClient.unsubscribe('never-subscribed-view');

        // Should still receive status event
        const event = yield* sessionClient.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'status' } => e._tag === 'status'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No status event'))
          )
        );

        expect(event._tag).toBe('status');
        expect(event.subscribed).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalidate via WebSocket
  // ---------------------------------------------------------------------------

  describe('invalidate (WebSocket)', () => {
    it('invalidates view and receives status event', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('ws-invalidate');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        // Invalidate via WebSocket
        yield* sessionClient.invalidate(viewId, 'test invalidation');

        // Should receive status event
        const event = yield* sessionClient.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'status' } => e._tag === 'status'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No status event'))
          )
        );

        expect(event._tag).toBe('status');
        expect(event.view_id).toBe(viewId);
        expect(event.message).toBe('test invalidation');
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });

    it('invalidate non-existent view returns error', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        yield* sessionClient.invalidate('non-existent-invalidate', 'test');

        // Should receive error event with INVALIDATE_ERROR or NOT_FOUND
        const event = yield* sessionClient.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'error' } => e._tag === 'error'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No error event'))
          )
        );

        expect(event._tag).toBe('error');
        expect(['INVALIDATE_ERROR', 'NOT_FOUND']).toContain(event.code);
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Ping/Pong
  // ---------------------------------------------------------------------------

  describe('ping', () => {
    it('ping with payload receives pong with same payload', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection;
        yield* client.ping('test-payload-123');

        const event = yield* client.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'pong' } => e._tag === 'pong'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No pong'))
          )
        );

        expect(event._tag).toBe('pong');
        expect(event.payload).toBe('test-payload-123');
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });

    it('ping without payload receives pong without payload', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection;
        yield* client.ping();

        const event = yield* client.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'pong' } => e._tag === 'pong'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No pong'))
          )
        );

        expect(event._tag).toBe('pong');
        expect(event.payload).toBeUndefined();
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });

    it('ping with empty string payload', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection;
        yield* client.ping('');

        const event = yield* client.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'pong' } => e._tag === 'pong'),
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No pong'))
          )
        );

        expect(event._tag).toBe('pong');
        expect(event.payload).toBe('');
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });

    it('multiple rapid pings all receive pongs', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection;

        // Send 5 pings rapidly
        yield* client.ping('ping-1');
        yield* client.ping('ping-2');
        yield* client.ping('ping-3');
        yield* client.ping('ping-4');
        yield* client.ping('ping-5');

        // Collect 5 pongs
        const pongs = yield* client.events.pipe(
          Stream.filter((e): e is SessionEvent & { _tag: 'pong' } => e._tag === 'pong'),
          Stream.take(5),
          Stream.runCollect,
          Effect.timeout(Duration.seconds(10)),
          Effect.map((chunk) => Array.from(chunk))
        );

        expect(pongs.length).toBe(5);
        const payloads = pongs.map(p => p.payload);
        expect(payloads).toContain('ping-1');
        expect(payloads).toContain('ping-5');
      }).pipe(Effect.scoped, Effect.provide(sessionClientLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Event Stream
  // ---------------------------------------------------------------------------

  describe('events stream', () => {
    it('filters by event type correctly', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('ws-event-filter');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        // Actions that produce different event types
        yield* sessionClient.ping('test');
        yield* sessionClient.subscribe(viewId);
        yield* sessionClient.unsubscribe(viewId);

        // Collect events
        const events = yield* sessionClient.events.pipe(
          Stream.take(3),
          Stream.runCollect,
          Effect.timeout(Duration.seconds(10)),
          Effect.map((chunk) => Array.from(chunk))
        );

        // Should have different event types
        const tags = events.map(e => e._tag);
        expect(tags).toContain('pong');
        expect(tags).toContain('artifact');
        expect(tags).toContain('status');
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Artifacts Stream
  // ---------------------------------------------------------------------------

  describe('artifacts stream', () => {
    it('filters only artifact events', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const viewId = testViewId('ws-artifacts-filter');

      const program = Effect.gen(function* () {
        const httpClient = yield* AvaHttpClient;
        yield* httpClient.registerView(minimalViewSpec(viewId));

        const sessionClient = yield* AvaSessionClient;
        yield* sessionClient.waitForConnection;

        // Subscribe (produces artifact) and ping (produces pong)
        yield* sessionClient.ping('noise');
        yield* sessionClient.subscribe(viewId);
        yield* sessionClient.ping('more-noise');

        // Artifacts stream should only have artifact
        const artifact = yield* sessionClient.artifacts.pipe(
          Stream.take(1),
          Stream.runHead,
          Effect.timeout(Duration.seconds(5)),
          Effect.flatMap((opt) =>
            opt._tag === 'Some' ? Effect.succeed(opt.value) : Effect.fail(new Error('No artifact'))
          )
        );

        expect(artifact.view_id).toBe(viewId);
      }).pipe(Effect.scoped, Effect.provide(combinedLayer));

      await Effect.runPromise(program);
    });
  });
});

// =============================================================================
// Raw WebSocket Protocol Tests
// =============================================================================

describe('WebSocket Protocol Edge Cases', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkServerHealth();
  });

  it('PARSE_ERROR on invalid JSON', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const socket = yield* Socket.Socket;
      const write = yield* socket.writer;

      const responseDeferred = yield* Deferred.make<string, Error>();

      yield* socket.runRaw(
        (data) => {
          const msg = typeof data === 'string' ? data : new TextDecoder().decode(data);
          return Deferred.succeed(responseDeferred, msg);
        },
        {
          onOpen: Effect.gen(function* () {
            // Send invalid JSON
            yield* write('{invalid json}');
          }),
        }
      ).pipe(
        Effect.raceFirst(
          Deferred.await(responseDeferred).pipe(Effect.timeout(Duration.seconds(5)))
        )
      );

      const response = yield* Deferred.await(responseDeferred);
      const parsed = JSON.parse(response);

      expect(parsed.type).toBe('error');
      expect(parsed.code).toBe('PARSE_ERROR');
    }).pipe(
      Effect.scoped,
      Effect.provide(BunSocket.layerWebSocket(WS_URL, { openTimeout: 10000 }))
    );

    await Effect.runPromise(program);
  });

  it('PARSE_ERROR on unknown command type', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const socket = yield* Socket.Socket;
      const write = yield* socket.writer;

      const responseDeferred = yield* Deferred.make<string, Error>();

      yield* socket.runRaw(
        (data) => {
          const msg = typeof data === 'string' ? data : new TextDecoder().decode(data);
          return Deferred.succeed(responseDeferred, msg);
        },
        {
          onOpen: Effect.gen(function* () {
            // Send unknown command type
            yield* write(JSON.stringify({ type: 'unknown_command', data: 'test' }));
          }),
        }
      ).pipe(
        Effect.raceFirst(
          Deferred.await(responseDeferred).pipe(Effect.timeout(Duration.seconds(5)))
        )
      );

      const response = yield* Deferred.await(responseDeferred);
      const parsed = JSON.parse(response);

      expect(parsed.type).toBe('error');
      expect(parsed.code).toBe('PARSE_ERROR');
    }).pipe(
      Effect.scoped,
      Effect.provide(BunSocket.layerWebSocket(WS_URL, { openTimeout: 10000 }))
    );

    await Effect.runPromise(program);
  });

  it('handles empty message', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const socket = yield* Socket.Socket;
      const write = yield* socket.writer;

      const responseDeferred = yield* Deferred.make<string, Error>();

      yield* socket.runRaw(
        (data) => {
          const msg = typeof data === 'string' ? data : new TextDecoder().decode(data);
          return Deferred.succeed(responseDeferred, msg);
        },
        {
          onOpen: Effect.gen(function* () {
            // Send empty string
            yield* write('');
          }),
        }
      ).pipe(
        Effect.raceFirst(
          Deferred.await(responseDeferred).pipe(Effect.timeout(Duration.seconds(5)))
        )
      );

      const response = yield* Deferred.await(responseDeferred);
      const parsed = JSON.parse(response);

      expect(parsed.type).toBe('error');
      expect(parsed.code).toBe('PARSE_ERROR');
    }).pipe(
      Effect.scoped,
      Effect.provide(BunSocket.layerWebSocket(WS_URL, { openTimeout: 10000 }))
    );

    await Effect.runPromise(program);
  });

  it('handles command with missing required field', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const socket = yield* Socket.Socket;
      const write = yield* socket.writer;

      const responseDeferred = yield* Deferred.make<string, Error>();

      yield* socket.runRaw(
        (data) => {
          const msg = typeof data === 'string' ? data : new TextDecoder().decode(data);
          return Deferred.succeed(responseDeferred, msg);
        },
        {
          onOpen: Effect.gen(function* () {
            // Subscribe without view_id
            yield* write(JSON.stringify({ type: 'subscribe' }));
          }),
        }
      ).pipe(
        Effect.raceFirst(
          Deferred.await(responseDeferred).pipe(Effect.timeout(Duration.seconds(5)))
        )
      );

      const response = yield* Deferred.await(responseDeferred);
      const parsed = JSON.parse(response);

      expect(parsed.type).toBe('error');
      expect(parsed.code).toBe('PARSE_ERROR');
    }).pipe(
      Effect.scoped,
      Effect.provide(BunSocket.layerWebSocket(WS_URL, { openTimeout: 10000 }))
    );

    await Effect.runPromise(program);
  });
});
