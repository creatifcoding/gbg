/**
 * CollaborationService
 *
 * Effect.Service wrapping y-Sweet client for real-time Yjs sync.
 * Manages Y.Doc lifecycle and connection to y-sweet server.
 *
 * NOTE: State lives in ATOMS (Atom-as-State pattern).
 * This service is thin — just handles y-sweet API calls.
 *
 * @module editor/v3/services/CollaborationService
 */

import { Effect, Layer, Context } from 'effect';
import * as Y from 'yjs';
import { DocumentManager, type ClientToken } from '@y-sweet/sdk';

// =============================================================================
// Types (Canonical definitions)
// =============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * User info for collaboration cursors.
 * Shared by service, atoms, and extensions.
 */
export interface CollaborationUser {
  readonly name: string;
  readonly color: string;
}

export interface CollaborationConfig {
  readonly serverUrl: string;
}

// =============================================================================
// Configuration
// =============================================================================

export class CollaborationConfigTag extends Context.Tag('tmnl/editor/CollaborationConfig')<
  CollaborationConfigTag,
  CollaborationConfig
>() {
  static readonly Default = Layer.succeed(this, {
    serverUrl: 'ys://localhost:8080',
  });

  static readonly Custom = (config: CollaborationConfig) =>
    Layer.succeed(this, config);
}

// =============================================================================
// Service Interface
// =============================================================================

export interface CollaborationServiceShape {
  /**
   * Get or create document token from y-sweet.
   * Does NOT manage Y.Doc — that's the caller's job.
   */
  readonly getClientToken: (docId: string) => Effect.Effect<ClientToken, Error>;

  /**
   * Create a new Y.Doc instance.
   */
  readonly createDoc: () => Effect.Effect<Y.Doc, never>;

  /**
   * Destroy a Y.Doc instance.
   */
  readonly destroyDoc: (doc: Y.Doc) => Effect.Effect<void, never>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class CollaborationService extends Effect.Service<CollaborationService>()(
  'tmnl/editor/CollaborationService',
  {
    effect: Effect.gen(function* () {
      const config = yield* CollaborationConfigTag;
      const manager = new DocumentManager(config.serverUrl);

      const getClientToken = (docId: string): Effect.Effect<ClientToken, Error> =>
        Effect.tryPromise({
          try: () => manager.getOrCreateDocAndToken(docId),
          catch: (err) => new Error(`y-sweet connection failed: ${err}`),
        });

      const createDoc = () => Effect.sync(() => new Y.Doc());

      const destroyDoc = (doc: Y.Doc) => Effect.sync(() => doc.destroy());

      return {
        getClientToken,
        createDoc,
        destroyDoc,
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

// =============================================================================
// Utility: Generate user color
// =============================================================================

const COLLAB_PALETTE = [
  '#4ecdc4', // cyan
  '#ff6b6b', // coral
  '#95e1d3', // mint
  '#f38181', // salmon
  '#aa96da', // lavender
  '#fcbad3', // pink
  '#a8d8ea', // sky
  '#ffcc5c', // gold
] as const;

/**
 * Generate a consistent color for a user based on their name.
 * Same name = same color (deterministic hash).
 */
export function generateUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return COLLAB_PALETTE[Math.abs(hash) % COLLAB_PALETTE.length];
}
