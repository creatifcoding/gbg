/**
 * Collaboration Atoms
 *
 * Atom-as-State pattern for y-Sweet collaboration.
 * Runtime provides CollaborationService, ops mutate atoms via ctx.set().
 *
 * @module editor/v3/atoms/collaboration
 */

import { Atom } from '@effect-atom/atom';
import { Effect, Layer } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';
import type * as Y from 'yjs';
import {
  CollaborationService,
  CollaborationServiceLive,
  CollaborationConfigTag,
  type CollaborationState,
  type ConnectionStatus,
  type AwarenessUser,
  type AwarenessState,
  type CollaborationConfig,
} from '../services';

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Connection status atom.
 * Tracks: disconnected → connecting → connected | error
 */
export const collaborationStatusAtom = Atom.make<ConnectionStatus>('disconnected');

/**
 * Current document ID (null when disconnected).
 */
export const collaborationDocIdAtom = Atom.make<string | null>(null);

/**
 * Y.Doc instance (null when disconnected).
 * Use this to access Yjs data structures.
 */
export const yDocAtom = Atom.make<Y.Doc | null>(null);

/**
 * Client token for y-sweet React provider.
 * Pass this to YDocProvider from @y-sweet/react.
 */
export const clientTokenAtom = Atom.make<ClientToken | null>(null);

/**
 * Awareness states from all connected clients.
 * Map of clientId → AwarenessState.
 */
export const awarenessAtom = Atom.make<ReadonlyMap<number, AwarenessState>>(new Map());

/**
 * Connection error message (null when no error).
 */
export const collaborationErrorAtom = Atom.make<string | null>(null);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Is collaboration connected?
 */
export const isCollaboratingAtom = Atom.make((get) => {
  return get(collaborationStatusAtom) === 'connected';
});

/**
 * Number of connected users.
 */
export const connectedUsersCountAtom = Atom.make((get) => {
  return get(awarenessAtom).size;
});

/**
 * List of connected users as array.
 */
export const connectedUsersAtom = Atom.make((get) => {
  return Array.from(get(awarenessAtom).values());
});

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Collaboration runtime atom.
 * Provides CollaborationService to operation atoms.
 */
export const collaborationRuntimeAtom = Atom.runtime(
  Layer.mergeAll(CollaborationServiceLive)
);

/**
 * Create a custom runtime with specific config.
 */
export const createCollaborationRuntime = (config: CollaborationConfig) =>
  Atom.runtime(
    Layer.mergeAll(
      CollaborationService.Default.pipe(
        Layer.provide(CollaborationConfigTag.Custom(config))
      )
    )
  );

// =============================================================================
// Operation Atoms
// =============================================================================

/**
 * Collaboration operations.
 * Each returns a Promise that resolves when the operation completes.
 */
export const collaborationOps = {
  /**
   * Connect to a document by ID.
   * Creates the document if it doesn't exist.
   */
  connect: collaborationRuntimeAtom.fn<{ docId: string }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* CollaborationService;

      // Update atoms to connecting state
      ctx.set(collaborationStatusAtom, 'connecting');
      ctx.set(collaborationDocIdAtom, args.docId);
      ctx.set(collaborationErrorAtom, null);

      try {
        const clientToken = yield* service.connect(args.docId);
        const state = yield* service.getState;

        // Update atoms with connected state
        ctx.set(collaborationStatusAtom, 'connected');
        ctx.set(yDocAtom, state.doc);
        ctx.set(clientTokenAtom, clientToken);

        return clientToken;
      } catch (err) {
        ctx.set(collaborationStatusAtom, 'error');
        ctx.set(collaborationErrorAtom, err instanceof Error ? err.message : String(err));
        throw err;
      }
    })
  ),

  /**
   * Disconnect from the current document.
   */
  disconnect: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* CollaborationService;
      yield* service.disconnect;

      // Reset all atoms
      ctx.set(collaborationStatusAtom, 'disconnected');
      ctx.set(collaborationDocIdAtom, null);
      ctx.set(yDocAtom, null);
      ctx.set(clientTokenAtom, null);
      ctx.set(awarenessAtom, new Map());
      ctx.set(collaborationErrorAtom, null);
    })
  ),

  /**
   * Update local user's awareness state.
   */
  setLocalAwareness: collaborationRuntimeAtom.fn<{ user: Partial<AwarenessUser> }>()(
    (args, ctx) =>
      Effect.gen(function* () {
        const service = yield* CollaborationService;
        yield* service.setLocalAwareness(args.user);

        // Update awareness atom
        const awareness = yield* service.getAwareness;
        ctx.set(awarenessAtom, awareness);
      })
  ),

  /**
   * Refresh awareness from service.
   */
  refreshAwareness: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* CollaborationService;
      const awareness = yield* service.getAwareness;
      ctx.set(awarenessAtom, awareness);
    })
  ),
};

// =============================================================================
// Query Atoms
// =============================================================================

/**
 * Query atoms for collaboration state.
 */
export const collaborationQueries = {
  /**
   * Current connection status.
   */
  status: collaborationStatusAtom,

  /**
   * Current document ID.
   */
  docId: collaborationDocIdAtom,

  /**
   * Y.Doc instance.
   */
  doc: yDocAtom,

  /**
   * Client token for React provider.
   */
  clientToken: clientTokenAtom,

  /**
   * Awareness states.
   */
  awareness: awarenessAtom,

  /**
   * Is connected?
   */
  isCollaborating: isCollaboratingAtom,

  /**
   * Connected users count.
   */
  usersCount: connectedUsersCountAtom,

  /**
   * Connected users list.
   */
  users: connectedUsersAtom,
};
