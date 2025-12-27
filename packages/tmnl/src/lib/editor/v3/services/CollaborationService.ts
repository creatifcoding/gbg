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

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

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

/**
 * Get y-sweet server URL for HTTP API calls.
 * In browser dev mode, use Vite proxy to avoid CORS.
 * Otherwise, use direct connection.
 */
function getDefaultServerUrl(): string {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    // Dev mode: use Vite proxy at /y-sweet to avoid CORS
    return `${window.location.origin}/y-sweet`;
  }
  // Production or non-browser: direct connection
  return 'http://localhost:8080';
}

/**
 * Patch ClientToken URLs to use Vite proxy in dev mode.
 * The y-sweet server returns URLs like ws://localhost:8080/d/{docId}/ws
 * which would bypass our proxy. We rewrite them to use the proxy path.
 */
function patchClientTokenForProxy(token: ClientToken): ClientToken {
  // Validate token has required url field
  if (!token.url) {
    console.error(
      '[CollaborationService] Invalid token: missing url field',
      token
    );
    throw new Error('Invalid ClientToken: missing url field');
  }

  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return token;
  }

  const origin = window.location.origin;
  const wsOrigin = origin.replace(/^http/, 'ws'); // http -> ws, https -> wss

  // Patch the WebSocket URL to go through Vite proxy
  // e.g., ws://localhost:8080/d/xxx/ws -> ws://localhost:1420/y-sweet/d/xxx/ws
  const patchedUrl = token.url.replace(
    /^wss?:\/\/[^/]+/,
    `${wsOrigin}/y-sweet`
  );

  // Patch baseUrl if present
  const patchedBaseUrl = token.baseUrl?.replace(
    /^https?:\/\/[^/]+/,
    `${origin}/y-sweet`
  );

  return {
    ...token,
    url: patchedUrl,
    baseUrl: patchedBaseUrl,
  };
}

export class CollaborationConfigTag extends Context.Tag(
  'tmnl/editor/CollaborationConfig'
)<CollaborationConfigTag, CollaborationConfig>() {
  static readonly Default = Layer.succeed(this, {
    serverUrl: getDefaultServerUrl(),
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
      console.log(
        '[CollaborationService] Initializing with serverUrl:',
        config.serverUrl
      );
      const manager = new DocumentManager(config.serverUrl);

      const getClientToken = (
        docId: string
      ): Effect.Effect<ClientToken, Error> =>
        Effect.tryPromise({
          try: async () => {
            console.log(
              '[CollaborationService] Calling getOrCreateDocAndToken for:',
              docId
            );
            const token = await manager.getOrCreateDocAndToken(docId);
            console.log('[CollaborationService] Raw token from SDK:', token);
            return token;
          },
          catch: (err) => new Error(`y-sweet connection failed: ${err}`),
        }).pipe(
          // Patch URLs to use Vite proxy in dev mode
          Effect.map(patchClientTokenForProxy)
        );

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
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash & hash;
  }
  return COLLAB_PALETTE[Math.abs(hash) % COLLAB_PALETTE.length];
}
