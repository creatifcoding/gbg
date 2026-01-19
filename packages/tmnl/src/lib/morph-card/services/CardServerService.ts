/**
 * CardServerService
 *
 * Effect.Service for server communication from DynamicIslandCards.
 * Provides query, stream, and subscription methods for bidirectional
 * communication with the cursor server.
 *
 * @module morph-card/services/CardServerService
 */

import { Context, Effect, Stream, Layer, Data } from 'effect';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Base URL for the cursor server
 */
const DEFAULT_BASE_URL = 'http://localhost:3000';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when server query fails
 */
export class CardServerQueryError extends Data.TaggedError('CardServerQueryError')<{
  readonly endpoint: string;
  readonly cardId: string;
  readonly cause: unknown;
  readonly retryable: boolean;
}> {
  override get message(): string {
    return `Query to ${this.endpoint} failed for card ${this.cardId}: ${this.cause}`;
  }

  static create(
    endpoint: string,
    cardId: string,
    cause: unknown,
    retryable = true
  ): CardServerQueryError {
    return new CardServerQueryError({ endpoint, cardId, cause, retryable });
  }
}

/**
 * Error when SSE stream fails
 */
export class CardServerStreamError extends Data.TaggedError('CardServerStreamError')<{
  readonly endpoint: string;
  readonly cardId: string;
  readonly cause: unknown;
}> {
  override get message(): string {
    return `Stream from ${this.endpoint} failed for card ${this.cardId}: ${this.cause}`;
  }

  static create(
    endpoint: string,
    cardId: string,
    cause: unknown
  ): CardServerStreamError {
    return new CardServerStreamError({ endpoint, cardId, cause });
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Query parameters
 */
export interface QueryParams {
  readonly [key: string]: unknown;
}

/**
 * Query options
 */
export interface QueryOptions {
  readonly method?: 'GET' | 'POST';
  readonly params?: QueryParams;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

/**
 * Stream event from SSE
 */
export interface StreamEvent {
  readonly type: string;
  readonly data: unknown;
  readonly timestamp: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface CardServerServiceShape {
  /**
   * Query an endpoint with params
   */
  readonly query: (
    cardId: string,
    endpoint: string,
    options?: QueryOptions
  ) => Effect.Effect<unknown, CardServerQueryError>;

  /**
   * Stream SSE events from an endpoint
   */
  readonly stream: (
    cardId: string,
    endpoint: string
  ) => Stream.Stream<StreamEvent, CardServerStreamError>;

  /**
   * Subscribe to a topic (convenience wrapper around stream)
   */
  readonly subscribe: (
    cardId: string,
    topic: string,
    handler: (data: unknown) => void
  ) => Effect.Effect<() => void, CardServerStreamError>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class CardServerService extends Context.Tag('tmnl/morph-card/CardServerService')<
  CardServerService,
  CardServerServiceShape
>() {
  /**
   * Live implementation with configurable base URL
   */
  static readonly Live = (baseUrl: string = DEFAULT_BASE_URL) =>
    Layer.succeed(
      this,
      {
        query: (
          cardId: string,
          endpoint: string,
          options?: QueryOptions
        ): Effect.Effect<unknown, CardServerQueryError> =>
          Effect.gen(function* () {
            const method = options?.method ?? 'GET';
            const url = new URL(`${baseUrl}${endpoint}`);

            // Add query params for GET
            if (options?.params && method === 'GET') {
              Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.set(key, String(value));
              });
            }

            const fetchOptions: RequestInit = {
              method,
              headers: {
                'Content-Type': 'application/json',
                'X-Card-Id': cardId,
                ...options?.headers,
              },
            };

            // Add body for POST
            if (options?.body && method === 'POST') {
              fetchOptions.body = JSON.stringify(options.body);
            }

            const response = yield* Effect.tryPromise({
              try: async () => fetch(url.toString(), fetchOptions),
              catch: (e) => CardServerQueryError.create(endpoint, cardId, e, true),
            });

            if (!response.ok) {
              const errorText = yield* Effect.tryPromise({
                try: () => response.text(),
                catch: () => CardServerQueryError.create(endpoint, cardId, 'Failed to read error text', false),
              }).pipe(Effect.catchAll(() => Effect.succeed('Unknown error')));

              return yield* Effect.fail(
                CardServerQueryError.create(
                  endpoint,
                  cardId,
                  `HTTP ${response.status}: ${errorText}`,
                  response.status >= 500
                )
              );
            }

            const data = yield* Effect.tryPromise({
              try: () => response.json(),
              catch: (e) =>
                CardServerQueryError.create(endpoint, cardId, `JSON parse error: ${e}`, false),
            });

            return data;
          }),

        stream: (cardId: string, endpoint: string): Stream.Stream<StreamEvent, CardServerStreamError> =>
          Stream.async<StreamEvent, CardServerStreamError>((emit) => {
            const url = `${baseUrl}${endpoint}?cardId=${encodeURIComponent(cardId)}`;
            const eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                emit.single({
                  type: event.type || 'message',
                  data,
                  timestamp: Date.now(),
                });
              } catch {
                // If JSON parse fails, emit raw data
                emit.single({
                  type: event.type || 'message',
                  data: event.data,
                  timestamp: Date.now(),
                });
              }
            };

            eventSource.onerror = () => {
              emit.fail(CardServerStreamError.create(endpoint, cardId, 'SSE connection failed'));
            };

            return Effect.sync(() => {
              eventSource.close();
            });
          }),

        subscribe: (
          cardId: string,
          topic: string,
          handler: (data: unknown) => void
        ): Effect.Effect<() => void, CardServerStreamError> =>
          Effect.sync(() => {
            const url = `${baseUrl}/subscribe/${topic}?cardId=${encodeURIComponent(cardId)}`;
            const eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                handler(data);
              } catch {
                handler(event.data);
              }
            };

            eventSource.onerror = () => {
              console.error(`[CardServerService] Subscription to ${topic} failed for card ${cardId}`);
            };

            return () => eventSource.close();
          }),
      }
    );

  /**
   * Default live layer using localhost:3000
   */
  static readonly Default = CardServerService.Live();
}

// =============================================================================
// Convenience Exports
// =============================================================================

export const CardServerServiceLive = CardServerService.Default;
