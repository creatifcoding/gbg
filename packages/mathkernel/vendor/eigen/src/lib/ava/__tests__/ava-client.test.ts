/**
 * AVA Client Test Suite
 *
 * Effect-based tests using @effect/vitest patterns.
 * Tests HTTP and WebSocket clients with mock layers.
 *
 * Patterns from: EFFECT_TESTING_PATTERNS.md
 *
 * @module
 */

import { describe, it, expect } from '@effect/vitest';
import { Effect, Stream } from 'effect';

import { AvaHttpClient, AvaNotFoundError } from '../http-client';
import { AvaSessionClient } from '../session-client';
import {
  AvaTestLayerMock,
  MockHttpClientLayer,
  MockSessionClientLayer,
  mockViewSpec,
  mockViewArtifact,
} from '../test-harness';

// ============================================================================
// HTTP Client Tests
// ============================================================================

describe('AvaHttpClient', () => {
  describe('listViews', () => {
    it.effect('returns list of views', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const views = yield* client.listViews();

        expect(Array.isArray(views)).toBe(true);
        expect(views.length).toBeGreaterThan(0);
        expect(views[0]).toHaveProperty('id');
        expect(views[0]).toHaveProperty('name');
        expect(views[0]).toHaveProperty('version');
      }).pipe(Effect.provide(MockHttpClientLayer))
    );
  });

  describe('registerView', () => {
    it.effect('creates a new view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.registerView({
          name: 'New Test View',
          assemblage_id: 'test-assemblage',
          channels: [
            {
              id: 'ch-new',
              role: 'State',
              source_connection: 'test://new',
            },
          ],
        });

        expect(response.was_created).toBe(true);
        expect(response.view_id).toBeDefined();
        expect(response.version).toBe(1);
      }).pipe(Effect.provide(MockHttpClientLayer))
    );

    it.effect('updates existing view with same id', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;

        // First registration
        const first = yield* client.registerView({
          id: 'update-test',
          name: 'First Version',
          assemblage_id: 'test-assemblage',
          channels: [],
        });
        expect(first.was_created).toBe(true);

        // Second registration with same id
        const second = yield* client.registerView({
          id: 'update-test',
          name: 'Second Version',
          assemblage_id: 'test-assemblage',
          channels: [],
        });
        expect(second.was_created).toBe(false);
        expect(second.view_id).toBe('update-test');
      }).pipe(Effect.provide(MockHttpClientLayer))
    );
  });

  describe('getSpec', () => {
    it.effect('returns spec for existing view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const spec = yield* client.getSpec('test-view-1');

        expect(spec.id).toBe(mockViewSpec.id);
        expect(spec.name).toBe(mockViewSpec.name);
        expect(spec.channels.length).toBe(mockViewSpec.channels.length);
      }).pipe(Effect.provide(MockHttpClientLayer))
    );

    it.effect('fails with AvaNotFoundError for missing view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const result = yield* client.getSpec('non-existent').pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
        expect((result as AvaNotFoundError).resource).toBe('view');
        expect((result as AvaNotFoundError).id).toBe('non-existent');
      }).pipe(Effect.provide(MockHttpClientLayer))
    );
  });

  describe('getArtifact', () => {
    it.effect('returns artifact for existing view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const artifact = yield* client.getArtifact('test-view-1');

        expect(artifact.view_id).toBe('test-view-1');
        expect(artifact.spec).toBeDefined();
        expect(artifact.channel_bindings).toBeDefined();
        expect(artifact.created_at_ms).toBeGreaterThan(0);
      }).pipe(Effect.provide(MockHttpClientLayer))
    );
  });

  describe('getStatus', () => {
    it.effect('returns status for existing view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const status = yield* client.getStatus('test-view-1');

        expect(status.view_id).toBe('test-view-1');
        expect(typeof status.is_subscribed).toBe('boolean');
        expect(typeof status.total_subscriptions).toBe('number');
      }).pipe(Effect.provide(MockHttpClientLayer))
    );
  });

  describe('invalidate', () => {
    it.effect('invalidates existing view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const response = yield* client.invalidate('test-view-1', {
          reason: 'Test invalidation',
        });

        expect(response.view_id).toBe('test-view-1');
        expect(response.message).toContain('invalidated');
      }).pipe(Effect.provide(MockHttpClientLayer))
    );

    it.effect('fails for non-existent view', () =>
      Effect.gen(function* () {
        const client = yield* AvaHttpClient;
        const result = yield* client
          .invalidate('non-existent')
          .pipe(Effect.flip);

        expect(result._tag).toBe('AvaNotFoundError');
      }).pipe(Effect.provide(MockHttpClientLayer))
    );
  });
});

// ============================================================================
// Session Client Tests
// ============================================================================

describe('AvaSessionClient', () => {
  describe('connection', () => {
    it.effect('reports connected status', () =>
      Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        const connected = yield* client.isConnected;

        expect(connected).toBe(true);
      }).pipe(Effect.provide(MockSessionClientLayer))
    );

    it.effect('waitForConnection completes immediately when connected', () =>
      Effect.gen(function* () {
        const client = yield* AvaSessionClient;
        yield* client.waitForConnection;
        // If we get here, connection succeeded
      }).pipe(Effect.provide(MockSessionClientLayer))
    );
  });

  describe('subscribe', () => {
    it.effect('subscribes to view and receives artifact event', () =>
      Effect.gen(function* () {
        const client = yield* AvaSessionClient;

        // Subscribe
        yield* client.subscribe('test-view-1');

        // Should receive artifact event
        const event = yield* client.events.pipe(
          Stream.take(1),
          Stream.runHead
        );

        expect(event._tag).toBe('Some');
        if (event._tag === 'Some') {
          expect(event.value._tag).toBe('artifact');
        }
      }).pipe(Effect.provide(MockSessionClientLayer))
    );
  });

  describe('unsubscribe', () => {
    it.effect('unsubscribes from view and receives status event', () =>
      Effect.gen(function* () {
        const client = yield* AvaSessionClient;

        // Subscribe first
        yield* client.subscribe('test-view-1');

        // Drain the artifact event
        yield* client.events.pipe(Stream.take(1), Stream.runDrain);

        // Unsubscribe
        yield* client.unsubscribe('test-view-1');

        // Should receive status event
        const event = yield* client.events.pipe(
          Stream.take(1),
          Stream.runHead
        );

        expect(event._tag).toBe('Some');
        if (event._tag === 'Some') {
          expect(event.value._tag).toBe('status');
          if (event.value._tag === 'status') {
            expect(event.value.subscribed).toBe(false);
          }
        }
      }).pipe(Effect.provide(MockSessionClientLayer))
    );
  });

  describe('ping', () => {
    it.effect('sends ping and receives pong', () =>
      Effect.gen(function* () {
        const client = yield* AvaSessionClient;

        yield* client.ping('test-payload');

        const event = yield* client.events.pipe(
          Stream.take(1),
          Stream.runHead
        );

        expect(event._tag).toBe('Some');
        if (event._tag === 'Some') {
          expect(event.value._tag).toBe('pong');
          if (event.value._tag === 'pong') {
            expect(event.value.payload).toBe('test-payload');
          }
        }
      }).pipe(Effect.provide(MockSessionClientLayer))
    );
  });

  describe('artifacts stream', () => {
    it.effect('filters only artifact events', () =>
      Effect.gen(function* () {
        const client = yield* AvaSessionClient;

        // Subscribe to trigger artifact
        yield* client.subscribe('test-view-1');

        // Get from artifacts stream
        const artifact = yield* client.artifacts.pipe(
          Stream.take(1),
          Stream.runHead
        );

        expect(artifact._tag).toBe('Some');
        if (artifact._tag === 'Some') {
          expect(artifact.value.view_id).toBe('test-view-1');
          expect(artifact.value.spec).toBeDefined();
        }
      }).pipe(Effect.provide(MockSessionClientLayer))
    );
  });
});

// ============================================================================
// Combined Layer Tests
// ============================================================================

describe('AvaTestLayerMock (combined)', () => {
  it.effect('provides both HTTP and Session clients', () =>
    Effect.gen(function* () {
      const httpClient = yield* AvaHttpClient;
      const sessionClient = yield* AvaSessionClient;

      // Both should be available
      expect(httpClient.listViews).toBeDefined();
      expect(sessionClient.subscribe).toBeDefined();

      // Test interop - list views via HTTP
      const views = yield* httpClient.listViews();
      expect(views.length).toBeGreaterThan(0);

      // Subscribe via WebSocket
      yield* sessionClient.subscribe(views[0].id);

      // Should receive artifact
      const event = yield* sessionClient.events.pipe(
        Stream.take(1),
        Stream.runHead
      );
      expect(event._tag).toBe('Some');
    }).pipe(Effect.provide(AvaTestLayerMock))
  );
});
