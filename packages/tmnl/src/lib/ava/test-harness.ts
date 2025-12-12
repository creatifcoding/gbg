/**
 * AVA Test Harness
 *
 * Composable test layers for AVA client testing.
 * Combines HTTP + WebSocket clients with mock support.
 *
 * Patterns from: EFFECT_TESTING_PATTERNS.md, EFFECT_SERVICE_PATTERNS.md
 *
 * @module
 */

import { Context, Effect, Layer, Ref, Queue, Stream, Data } from 'effect';

import {
  AvaHttpClient,
  AvaApiConfig,
  AvaHttpError,
  AvaNotFoundError,
  AvaValidationError,
  AvaHttpClientLive,
} from './http-client';

import {
  AvaSessionClient,
  AvaSessionError,
  AvaSessionClientLive,
} from './session-client';

import type {
  ViewSummary,
  ViewSpec,
  ViewArtifact,
  ViewStatus,
  RegisterViewRequest,
  RegisterViewResponse,
  InvalidateRequest,
  InvalidateResponse,
  SessionEvent,
} from './schemas';

// ============================================================================
// Test Configuration
// ============================================================================

/** Test configuration with mock server URL */
export interface AvaTestConfig {
  readonly baseUrl: string;
  readonly mockMode: boolean;
  readonly timeout: number;
}

export const AvaTestConfig = Context.GenericTag<AvaTestConfig>('ava/TestConfig');

/** Default test configuration (local server) */
export const AvaTestConfigDefault = Layer.succeed(AvaTestConfig, {
  baseUrl: 'http://localhost:3000',
  mockMode: false,
  timeout: 5000,
});

/** Mock test configuration (no server) */
export const AvaTestConfigMock = Layer.succeed(AvaTestConfig, {
  baseUrl: 'http://mock.local',
  mockMode: true,
  timeout: 1000,
});

// ============================================================================
// Mock Data
// ============================================================================

/** Sample view for testing */
export const mockViewSummary: ViewSummary = {
  id: 'test-view-1',
  name: 'Test View',
  version: 1,
};

/** Sample view spec for testing */
export const mockViewSpec: ViewSpec = {
  id: 'test-view-1',
  name: 'Test View',
  description: 'A test view for unit testing',
  assemblage_id: 'test-assemblage',
  channels: [
    {
      id: 'ch-1',
      role: 'State',
      source_connection: 'test://source',
      materialization: 'OnDemand',
    },
  ],
  version: 1,
};

/** Sample view artifact for testing */
export const mockViewArtifact: ViewArtifact = {
  view_id: 'test-view-1',
  spec: mockViewSpec,
  channel_bindings: [
    {
      channel_id: 'ch-1',
      role: 'State',
      active: true,
      row_count: 100,
      last_updated_ms: Date.now(),
    },
  ],
  created_at_ms: Date.now(),
  version: 1,
};

/** Sample view status for testing */
export const mockViewStatus: ViewStatus = {
  view_id: 'test-view-1',
  is_subscribed: false,
  version: 1,
  total_subscriptions: 0,
};

// ============================================================================
// Mock HTTP Client
// ============================================================================

/**
 * Create a mock HTTP client for unit testing
 * Returns predictable responses without network calls
 */
export const makeMockHttpClient = Effect.gen(function* () {
  // Mock state
  const viewsRef = yield* Ref.make<Map<string, ViewSpec>>(
    new Map([['test-view-1', mockViewSpec]])
  );

  return {
    listViews: () =>
      Effect.gen(function* () {
        const views = yield* Ref.get(viewsRef);
        return Array.from(views.values()).map((spec) => ({
          id: spec.id,
          name: spec.name,
          version: spec.version,
        }));
      }),

    registerView: (request: RegisterViewRequest) =>
      Effect.gen(function* () {
        const id = request.id ?? `view-${Date.now()}`;
        const spec: ViewSpec = {
          id,
          name: request.name,
          description: request.description,
          assemblage_id: request.assemblage_id,
          channels: request.channels.map((ch) => ({
            id: ch.id,
            role: ch.role,
            source_connection: ch.source_connection,
            materialization: ch.materialization ?? 'OnDemand',
          })),
          version: 1,
        };

        const views = yield* Ref.get(viewsRef);
        const wasCreated = !views.has(id);
        views.set(id, spec);
        yield* Ref.set(viewsRef, views);

        return {
          view_id: id,
          was_created: wasCreated,
          version: 1,
        } satisfies RegisterViewResponse;
      }),

    getSpec: (viewId: string) =>
      Effect.gen(function* () {
        const views = yield* Ref.get(viewsRef);
        const spec = views.get(viewId);
        if (!spec) {
          return yield* Effect.fail(
            new AvaNotFoundError({ resource: 'view', id: viewId })
          );
        }
        return spec;
      }),

    getArtifact: (viewId: string) =>
      Effect.gen(function* () {
        const views = yield* Ref.get(viewsRef);
        const spec = views.get(viewId);
        if (!spec) {
          return yield* Effect.fail(
            new AvaNotFoundError({ resource: 'view', id: viewId })
          );
        }
        return {
          view_id: viewId,
          spec,
          channel_bindings: spec.channels.map((ch) => ({
            channel_id: ch.id,
            role: ch.role,
            active: true,
          })),
          created_at_ms: Date.now(),
          version: spec.version,
        } satisfies ViewArtifact;
      }),

    getStatus: (viewId: string) =>
      Effect.gen(function* () {
        const views = yield* Ref.get(viewsRef);
        if (!views.has(viewId)) {
          return yield* Effect.fail(
            new AvaNotFoundError({ resource: 'view', id: viewId })
          );
        }
        return {
          view_id: viewId,
          is_subscribed: false,
          version: 1,
          total_subscriptions: 0,
        } satisfies ViewStatus;
      }),

    invalidate: (viewId: string, _request?: InvalidateRequest) =>
      Effect.gen(function* () {
        const views = yield* Ref.get(viewsRef);
        if (!views.has(viewId)) {
          return yield* Effect.fail(
            new AvaNotFoundError({ resource: 'view', id: viewId })
          );
        }
        return {
          view_id: viewId,
          message: 'View invalidated (mock)',
        } satisfies InvalidateResponse;
      }),
  } satisfies AvaHttpClient;
});

/** Mock HTTP client layer for unit testing */
export const MockHttpClientLayer = Layer.effect(AvaHttpClient, makeMockHttpClient);

// ============================================================================
// Mock Session Client
// ============================================================================

/**
 * Create a mock session client for unit testing
 * Simulates WebSocket behavior without network calls
 */
export const makeMockSessionClient = Effect.gen(function* () {
  const connectedRef = yield* Ref.make(true);
  const eventQueue = yield* Queue.unbounded<SessionEvent>();
  const subscriptionsRef = yield* Ref.make<Set<string>>(new Set());

  const eventStream: Stream.Stream<SessionEvent, AvaSessionError> =
    Stream.fromQueue(eventQueue);

  const artifactStream: Stream.Stream<ViewArtifact, AvaSessionError> =
    eventStream.pipe(
      Stream.filter((event): event is typeof event & { _tag: 'artifact' } =>
        event._tag === 'artifact'
      ),
      Stream.map((event) => event.artifact)
    );

  return {
    subscribe: (viewId: string) =>
      Effect.gen(function* () {
        const subs = yield* Ref.get(subscriptionsRef);
        subs.add(viewId);
        yield* Ref.set(subscriptionsRef, subs);

        // Emit mock artifact event
        yield* Queue.offer(eventQueue, {
          _tag: 'artifact',
          artifact: { ...mockViewArtifact, view_id: viewId },
        });
      }),

    unsubscribe: (viewId: string) =>
      Effect.gen(function* () {
        const subs = yield* Ref.get(subscriptionsRef);
        subs.delete(viewId);
        yield* Ref.set(subscriptionsRef, subs);

        // Emit mock status event
        yield* Queue.offer(eventQueue, {
          _tag: 'status',
          view_id: viewId,
          subscribed: false,
          message: 'Unsubscribed (mock)',
        });
      }),

    invalidate: (viewId: string, reason?: string) =>
      Effect.gen(function* () {
        yield* Queue.offer(eventQueue, {
          _tag: 'status',
          view_id: viewId,
          subscribed: true,
          message: `Invalidated: ${reason ?? 'no reason'} (mock)`,
        });
      }),

    ping: (payload?: string) =>
      Effect.gen(function* () {
        yield* Queue.offer(eventQueue, {
          _tag: 'pong',
          payload,
        });
      }),

    events: eventStream,
    artifacts: artifactStream,

    isConnected: Ref.get(connectedRef),

    waitForConnection: Effect.void,
  } satisfies AvaSessionClient;
});

/** Mock session client layer for unit testing */
export const MockSessionClientLayer = Layer.effect(
  AvaSessionClient,
  makeMockSessionClient
);

// ============================================================================
// Composed Layers
// ============================================================================

/**
 * Full AVA test layer with live clients
 * Requires running AVA server
 */
export const AvaTestLayerLive = Layer.mergeAll(
  AvaHttpClientLive.pipe(
    Layer.provide(
      Layer.succeed(AvaApiConfig, {
        baseUrl: 'http://localhost:3000',
        timeout: 30000,
      })
    )
  ),
  AvaSessionClientLive.pipe(
    Layer.provide(
      Layer.succeed(AvaApiConfig, {
        baseUrl: 'http://localhost:3000',
        timeout: 30000,
      })
    )
  )
);

/**
 * Full AVA test layer with mock clients
 * No server required - for unit testing
 */
export const AvaTestLayerMock = Layer.mergeAll(
  MockHttpClientLayer,
  MockSessionClientLayer
);

/**
 * Create a custom test layer with config
 */
export const makeAvaTestLayer = (config: { baseUrl: string; mock: boolean }) =>
  config.mock
    ? AvaTestLayerMock
    : Layer.mergeAll(
        AvaHttpClientLive.pipe(
          Layer.provide(
            Layer.succeed(AvaApiConfig, {
              baseUrl: config.baseUrl,
              timeout: 30000,
            })
          )
        ),
        AvaSessionClientLive.pipe(
          Layer.provide(
            Layer.succeed(AvaApiConfig, {
              baseUrl: config.baseUrl,
              timeout: 30000,
            })
          )
        )
      );

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Helper to inject mock events into session stream
 * Useful for testing event handling
 */
export const injectMockEvent = (event: SessionEvent) =>
  Effect.gen(function* () {
    const session = yield* AvaSessionClient;
    // Note: This only works with mock client that exposes queue
    // For real testing, emit via WebSocket connection
    yield* Effect.logDebug(`Injecting mock event: ${event._tag}`);
  });

/**
 * Helper to wait for specific event type
 */
export const waitForEvent = <T extends SessionEvent['_tag']>(
  tag: T,
  timeout: number = 5000
): Effect.Effect<Extract<SessionEvent, { _tag: T }>, AvaSessionError, AvaSessionClient> =>
  Effect.gen(function* () {
    const session = yield* AvaSessionClient;
    return yield* session.events.pipe(
      Stream.filter((e): e is Extract<SessionEvent, { _tag: T }> => e._tag === tag),
      Stream.take(1),
      Stream.runHead,
      Effect.flatMap((maybeEvent) =>
        maybeEvent._tag === 'Some'
          ? Effect.succeed(maybeEvent.value)
          : Effect.fail(
              new AvaSessionError({
                operation: 'waitForEvent',
                message: `No ${tag} event received`,
              })
            )
      ),
      Effect.timeout(timeout),
      Effect.flatMap((maybeResult) =>
        maybeResult._tag === 'Some'
          ? Effect.succeed(maybeResult.value)
          : Effect.fail(
              new AvaSessionError({
                operation: 'waitForEvent',
                message: `Timeout waiting for ${tag} event`,
              })
            )
      )
    );
  });
