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

import React from 'react';
import { Atom, Registry } from '@effect-atom/atom';
import { RegistryContext } from '@effect-atom/atom-react';
import { Effect, Layer, pipe } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';

// =============================================================================
// Registry Singleton
// =============================================================================

/**
 * Global registry singleton for collaboration state mutations.
 * This is shared across all collaboration operations AND React components.
 *
 * IMPORTANT: Use collaborationRegistry.set() instead of Atom.set()
 * Atom.set() returns an Effect, collaborationRegistry.set() mutates directly.
 */
export const collaborationRegistry = Registry.make();

/**
 * Provides the collaboration registry to React components.
 * Wrap your collaboration UI with this provider so useAtomValue reads from
 * the same registry that collaborationRegistry.set() writes to.
 *
 * @example
 * ```tsx
 * <CollaborationRegistryProvider>
 *   <CollaborationTestbed />
 * </CollaborationRegistryProvider>
 * ```
 */
export function CollaborationRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // Type assertion needed due to version mismatch between @effect-atom/atom and @effect-atom/atom-react
  // TODO: Fix by aligning package versions in package.json
  return React.createElement(
    RegistryContext.Provider,
    { value: collaborationRegistry as any },
    children
  );
}

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
export const collaborationStatusAtom =
  Atom.make<ConnectionStatus>('disconnected');

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
// Document Registry Types & State
// =============================================================================

/**
 * Recent document entry for local registry.
 */
export interface RecentDoc {
  docId: string;
  petName: string;
  lastAccessed: number; // timestamp
}

const STORAGE_KEY_RECENT_DOCS = 'tmnl:collab:recentDocs';
const STORAGE_KEY_PET_NAME = 'tmnl:collab:petName';
const MAX_RECENT_DOCS = 10;

/**
 * Pet name adjectives for document naming.
 */
const ADJECTIVES = [
  'swift',
  'calm',
  'bold',
  'bright',
  'deep',
  'quick',
  'warm',
  'cool',
  'sharp',
  'soft',
];

/**
 * Pet name nouns for document naming.
 */
const NOUNS = [
  'fox',
  'owl',
  'river',
  'peak',
  'wave',
  'spark',
  'cloud',
  'stone',
  'leaf',
  'wind',
];

/**
 * Generate a random pet name for a document.
 */
export function generatePetName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
}

/**
 * Recent documents registry atom.
 */
export const recentDocsAtom = Atom.make<readonly RecentDoc[]>([]);

/**
 * Current document's pet name.
 */
export const currentPetNameAtom = Atom.make<string | null>(null);

/**
 * Document picker modal visibility.
 */
export const showDocPickerAtom = Atom.make<boolean>(false);

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

      console.log(
        '[collaborationOps.connect] Getting token for docId:',
        args.docId
      );

      const clientToken = yield* pipe(
        service.getClientToken(args.docId),
        Effect.tap((token) =>
          Effect.sync(() => {
            console.log('[collaborationOps.connect] Got token:', token);
          })
        ),
        Effect.tapError((err) =>
          Effect.sync(() => {
            console.error('[collaborationOps.connect] Error:', err);
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
  updateUsers: collaborationRuntimeAtom.fn<{
    users: readonly CollaborationUser[];
  }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(connectedUsersAtom, args.users);
    })
  ),

  // ===========================================================================
  // Document Registry Operations
  // ===========================================================================

  /**
   * Load recent documents from localStorage into atom.
   * Parses stored JSON, falls back to empty array on error.
   */
  loadRecentDocs: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    pipe(
      Effect.try({
        try: () => localStorage.getItem(STORAGE_KEY_RECENT_DOCS),
        catch: () => new Error('localStorage read failed'),
      }),
      Effect.map((stored) =>
        stored ? (JSON.parse(stored) as RecentDoc[]) : []
      ),
      Effect.catchAll(() => Effect.succeed([] as RecentDoc[])),
      Effect.tap((docs) => Effect.sync(() => ctx.set(recentDocsAtom, docs)))
    )
  ),

  /**
   * Add or update a document in the recent docs registry.
   * Reads current state via ctx, transforms, writes back, persists to localStorage.
   */
  addToRecentDocs: collaborationRuntimeAtom.fn<{
    docId: string;
    petName: string;
  }>()((args, ctx) =>
    Effect.sync(() => {
      const recent = ctx(recentDocsAtom);
      const filtered = recent.filter((d) => d.docId !== args.docId);
      const entry: RecentDoc = {
        docId: args.docId,
        petName: args.petName,
        lastAccessed: Date.now(),
      };
      const updated = [entry, ...filtered].slice(0, MAX_RECENT_DOCS);
      ctx.set(recentDocsAtom, updated);
      localStorage.setItem(STORAGE_KEY_RECENT_DOCS, JSON.stringify(updated));
      return updated;
    })
  ),

  /**
   * Remove a document from the recent docs registry.
   */
  removeFromRecentDocs: collaborationRuntimeAtom.fn<{ docId: string }>()(
    (args, ctx) =>
      Effect.sync(() => {
        const recent = ctx(recentDocsAtom);
        const filtered = recent.filter((d) => d.docId !== args.docId);
        ctx.set(recentDocsAtom, filtered);
        localStorage.setItem(STORAGE_KEY_RECENT_DOCS, JSON.stringify(filtered));
        return filtered;
      })
  ),

  /**
   * Set the current document's pet name.
   * Persists to localStorage.
   */
  setPetName: collaborationRuntimeAtom.fn<{ petName: string }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(currentPetNameAtom, args.petName);
      localStorage.setItem(STORAGE_KEY_PET_NAME, args.petName);
      return args.petName;
    })
  ),

  /**
   * Load persisted pet name from localStorage.
   */
  loadPetName: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      const name = localStorage.getItem(STORAGE_KEY_PET_NAME);
      ctx.set(currentPetNameAtom, name);
      return name;
    })
  ),

  /**
   * Open document picker modal.
   */
  openDocPicker: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => ctx.set(showDocPickerAtom, true))
  ),

  /**
   * Close document picker modal.
   */
  closeDocPicker: collaborationRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => ctx.set(showDocPickerAtom, false))
  ),
};
