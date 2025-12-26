/**
 * CollaborationService
 *
 * Effect.Service wrapping y-Sweet client for real-time Yjs sync.
 * Manages Y.Doc lifecycle, connection state, and awareness protocol.
 *
 * @module editor/v3/services/CollaborationService
 */

import { Effect, Layer, Ref, Context } from 'effect';
import * as Y from 'yjs';
import { DocumentManager, type ClientToken } from '@y-sweet/sdk';

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AwarenessUser {
  readonly name: string;
  readonly color: string;
  readonly cursor?: {
    readonly anchor: number;
    readonly head: number;
  };
}

export interface AwarenessState {
  readonly clientId: number;
  readonly user: AwarenessUser;
}

export interface CollaborationState {
  readonly status: ConnectionStatus;
  readonly docId: string | null;
  readonly doc: Y.Doc | null;
  readonly clientToken: ClientToken | null;
  readonly awareness: ReadonlyMap<number, AwarenessState>;
  readonly error: string | null;
}

export interface CollaborationConfig {
  readonly serverUrl: string;
  readonly defaultUser: AwarenessUser;
}

// =============================================================================
// Configuration
// =============================================================================

export class CollaborationConfigTag extends Context.Tag('tmnl/editor/CollaborationConfig')<
  CollaborationConfigTag,
  CollaborationConfig
>() {
  static readonly Default = Layer.succeed(
    CollaborationConfigTag,
    CollaborationConfigTag.of({
      serverUrl: 'ys://localhost:8080',
      defaultUser: {
        name: 'Anonymous',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      },
    })
  );

  static readonly Custom = (config: CollaborationConfig) =>
    Layer.succeed(CollaborationConfigTag, CollaborationConfigTag.of(config));
}

// =============================================================================
// Service Interface
// =============================================================================

export interface CollaborationServiceShape {
  /**
   * Connect to a y-sweet document by ID.
   * Creates a new document if it doesn't exist.
   */
  readonly connect: (docId: string) => Effect.Effect<ClientToken, Error>;

  /**
   * Disconnect from the current document.
   * Cleans up Y.Doc and connection resources.
   */
  readonly disconnect: Effect.Effect<void, never>;

  /**
   * Get current connection state.
   */
  readonly getState: Effect.Effect<CollaborationState, never>;

  /**
   * Get the Y.Doc instance (null if not connected).
   */
  readonly getDoc: Effect.Effect<Y.Doc | null, never>;

  /**
   * Get client token for React provider.
   */
  readonly getClientToken: Effect.Effect<ClientToken | null, never>;

  /**
   * Set local awareness state (cursor, user info).
   */
  readonly setLocalAwareness: (user: Partial<AwarenessUser>) => Effect.Effect<void, never>;

  /**
   * Get all awareness states.
   */
  readonly getAwareness: Effect.Effect<ReadonlyMap<number, AwarenessState>, never>;

  /**
   * Subscribe to state changes (returns unsubscribe function).
   */
  readonly subscribe: (
    callback: (state: CollaborationState) => void
  ) => Effect.Effect<() => void, never>;
}

// =============================================================================
// Service Implementation
// =============================================================================

const initialState: CollaborationState = {
  status: 'disconnected',
  docId: null,
  doc: null,
  clientToken: null,
  awareness: new Map(),
  error: null,
};

export class CollaborationService extends Effect.Service<CollaborationService>()(
  'tmnl/editor/CollaborationService',
  {
    effect: Effect.gen(function* () {
      const config = yield* CollaborationConfigTag;
      const stateRef = yield* Ref.make<CollaborationState>(initialState);
      const listenersRef = yield* Ref.make<Set<(state: CollaborationState) => void>>(new Set());

      // Create document manager
      const manager = new DocumentManager(config.serverUrl);

      // Notify all listeners of state change
      const notifyListeners = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        const listeners = yield* Ref.get(listenersRef);
        for (const listener of listeners) {
          listener(state);
        }
      });

      // Update state and notify
      const updateState = (updater: (s: CollaborationState) => CollaborationState) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, updater);
          yield* notifyListeners;
        });

      const connect = (docId: string): Effect.Effect<ClientToken, Error> =>
        Effect.gen(function* () {
          // Set connecting state
          yield* updateState((s) => ({
            ...s,
            status: 'connecting' as const,
            docId,
            error: null,
          }));

          // Get or create document token from y-sweet
          const clientToken = yield* Effect.tryPromise({
            try: () => manager.getOrCreateDocAndToken(docId),
            catch: (err) => new Error(`Failed to connect to y-sweet: ${err}`),
          });

          // Create Y.Doc
          const doc = new Y.Doc();

          // Update state with connected info
          yield* updateState((s) => ({
            ...s,
            status: 'connected' as const,
            doc,
            clientToken,
          }));

          return clientToken;
        }).pipe(
          Effect.catchAll((err) =>
            Effect.gen(function* () {
              yield* updateState((s) => ({
                ...s,
                status: 'error' as const,
                error: err.message,
              }));
              return yield* Effect.fail(err);
            })
          )
        );

      const disconnect = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);

        // Destroy Y.Doc if it exists
        if (state.doc) {
          state.doc.destroy();
        }

        // Reset to initial state
        yield* updateState(() => initialState);
      });

      const getState = Ref.get(stateRef);

      const getDoc = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return state.doc;
      });

      const getClientToken = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return state.clientToken;
      });

      const setLocalAwareness = (user: Partial<AwarenessUser>) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!state.doc) return;

          // Awareness is managed by the React provider, but we track local state
          const currentAwareness = new Map(state.awareness);
          const localClientId = state.doc.clientID;

          const existingState = currentAwareness.get(localClientId);
          const updatedUser: AwarenessUser = {
            ...config.defaultUser,
            ...existingState?.user,
            ...user,
          };

          currentAwareness.set(localClientId, {
            clientId: localClientId,
            user: updatedUser,
          });

          yield* updateState((s) => ({
            ...s,
            awareness: currentAwareness,
          }));
        });

      const getAwareness = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return state.awareness;
      });

      const subscribe = (callback: (state: CollaborationState) => void) =>
        Effect.gen(function* () {
          yield* Ref.update(listenersRef, (listeners) => {
            const newListeners = new Set(listeners);
            newListeners.add(callback);
            return newListeners;
          });

          // Return unsubscribe function
          return () => {
            Effect.runSync(
              Ref.update(listenersRef, (listeners) => {
                const newListeners = new Set(listeners);
                newListeners.delete(callback);
                return newListeners;
              })
            );
          };
        });

      return {
        connect,
        disconnect,
        getState,
        getDoc,
        getClientToken,
        setLocalAwareness,
        getAwareness,
        subscribe,
      } satisfies CollaborationServiceShape;
    }),
    dependencies: [CollaborationConfigTag.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const CollaborationServiceLive = CollaborationService.Default;

export const CollaborationServiceCustom = (config: CollaborationConfig) =>
  CollaborationService.Default.pipe(
    Layer.provide(CollaborationConfigTag.Custom(config))
  );
