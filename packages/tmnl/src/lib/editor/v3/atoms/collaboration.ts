/**
 * Collaboration Atoms
 *
 * Atom-as-State pattern for y-Sweet collaboration.
 * Runtime provides CollaborationService, ops mutate atoms via ctx.set().
 *
 * NOTE: Y.Doc lifecycle is managed by YDocProvider from @y-sweet/react.
 * These atoms track connection state and client tokens.
 *
 * @module editor/v3/atoms/collaboration
 */

import { Atom } from '@effect-atom/atom';
import { Effect, Layer, pipe } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';
import {
  CollaborationService,
  CollaborationServiceLive,
  CollaborationConfigTag,
  type ConnectionStatus,
  type CollaborationConfig,
  type CollaborationUser,
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
 * Client token for y-sweet React provider.
 * Pass this to YDocProvider from @y-sweet/react.
 */
export const clientTokenAtom = Atom.make<ClientToken | null>(null);

/**
 * Connection error message (null when no error).
 */
export const collaborationErrorAtom = Atom.make<string | null>(null);

/**
 * Connected users (managed by awareness in React component).
 * Updated via collaborationOps.updateUsers().
 */
export const connectedUsersAtom = Atom.make<readonly CollaborationUser[]>([]);

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
  return get(connectedUsersAtom).length;
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
   * Gets client token from y-sweet server.
   * Use the returned token with YDocProvider.
   */
  connect: collaborationRuntimeAtom.fn<{ docId: string }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* CollaborationService;

      // Update atoms to connecting state
      ctx.set(collaborationStatusAtom, 'connecting');
      ctx.set(collaborationDocIdAtom, args.docId);
      ctx.set(collaborationErrorAtom, null);

      const clientToken = yield* pipe(
        service.getClientToken(args.docId),
        Effect.tapError((err) =>
          Effect.sync(() => {
            ctx.set(collaborationStatusAtom, 'error');
            ctx.set(collaborationErrorAtom, err.message);
          })
        )
      );

      // Update atoms with connected state
      ctx.set(collaborationStatusAtom, 'connected');
      ctx.set(clientTokenAtom, clientToken);

      return clientToken;
    })
  ),

  /**
   * Disconnect from the current document.
   * Resets all collaboration atoms.
   */
  disconnect: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(collaborationStatusAtom, 'disconnected');
      ctx.set(collaborationDocIdAtom, null);
      ctx.set(clientTokenAtom, null);
      ctx.set(connectedUsersAtom, []);
      ctx.set(collaborationErrorAtom, null);
    })
  ),

  /**
   * Update connected users list.
   * Call this from awareness change callback in React component.
   */
  updateUsers: collaborationRuntimeAtom.fn<{ users: readonly CollaborationUser[] }>()(
    (args, ctx) =>
      Effect.sync(() => {
        ctx.set(connectedUsersAtom, args.users);
      })
  ),
};
