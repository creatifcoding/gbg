/**
 * Panel-Scoped State (STX)
 *
 * Atom.family-based state isolation for autonomous editor panels.
 * Each panel gets its own atoms keyed by panelId — NO SHARED STATE.
 *
 * PATTERN: Atom.family creates a function that returns the same atom
 * instance for the same key, ensuring stable references.
 *
 * CRITICAL: Must wrap consuming components with <PanelRegistryProvider>
 * to provide the registry context for atom subscriptions.
 *
 * @module testbed/collaboration/v2/panel-stx
 */

import * as React from 'react';
import { Atom, Registry } from '@effect-atom/atom';
import { RegistryContext, Atom as AtomReact } from '@effect-atom/atom-react';
import { Effect, Layer, pipe } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';
import {
  CollaborationService,
  CollaborationServiceLive,
  type CollaborationUser,
} from '@/lib/editor/v3/services';

// =============================================================================
// Registry
// =============================================================================

/**
 * Panel registry singleton for state mutations.
 * Use panelRegistry.set() for synchronous updates.
 */
export const panelRegistry = Registry.make();
// Add identity marker for debugging
(panelRegistry as any)._id = 'panelRegistry-' + Date.now();

/**
 * Provider component that injects panelRegistry into React context.
 * MUST wrap any component using useAtomValue/useAtomSet with panel atoms.
 *
 * NOTE: Uses RegistryContext.Provider directly (not RegistryProvider)
 * because we need to inject our pre-existing panelRegistry singleton.
 */
export function PanelRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // Debug: log when provider mounts
  React.useEffect(() => {
    console.log('[PanelRegistryProvider] Mounted with registry:', (panelRegistry as any)._id);
  }, []);

  // Type assertion needed due to version mismatch between @effect-atom/atom and @effect-atom/atom-react
  return React.createElement(
    RegistryContext.Provider,
    { value: panelRegistry as any },
    children
  );
}

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface RecentDoc {
  docId: string;
  petName: string;
  lastAccessed: number;
}

// =============================================================================
// Panel-Scoped Atom Families
// =============================================================================

/**
 * Connection status per panel.
 * Usage: panelStatusAtom(panelId)
 */
export const panelStatusAtom = Atom.family((panelId: string) =>
  Atom.make<ConnectionStatus>('disconnected')
);

/**
 * Current document ID per panel (null when disconnected).
 */
export const panelDocIdAtom = Atom.family((panelId: string) =>
  Atom.make<string | null>(null)
);

/**
 * Client token per panel for y-sweet provider.
 */
export const panelClientTokenAtom = Atom.family((panelId: string) =>
  Atom.make<ClientToken | null>(null)
);

/**
 * Connection error per panel.
 */
export const panelErrorAtom = Atom.family((panelId: string) =>
  Atom.make<string | null>(null)
);

/**
 * Connected users per panel.
 */
export const panelUsersAtom = Atom.family((panelId: string) =>
  Atom.make<readonly CollaborationUser[]>([])
);

/**
 * Pet name for current document per panel.
 */
export const panelPetNameAtom = Atom.family((panelId: string) =>
  Atom.make<string | null>(null)
);

/**
 * Drawer open state per panel.
 */
export const panelDrawerOpenAtom = Atom.family((panelId: string) =>
  Atom.make<boolean>(false)
);

// =============================================================================
// Derived Atoms (per panel)
// =============================================================================

/**
 * Is panel connected?
 */
export const panelIsConnectedAtom = Atom.family((panelId: string) =>
  Atom.make((get) => get(panelStatusAtom(panelId)) === 'connected')
);

/**
 * Is panel in connecting state?
 */
export const panelIsConnectingAtom = Atom.family((panelId: string) =>
  Atom.make((get) => get(panelStatusAtom(panelId)) === 'connecting')
);

/**
 * User count per panel.
 */
export const panelUserCountAtom = Atom.family((panelId: string) =>
  Atom.make((get) => get(panelUsersAtom(panelId)).length)
);

/**
 * Recent documents specific to this panel.
 * Derived from shared recentDocsAtom, showing only docs accessed by this panel.
 *
 * NOTE: For now, returns all recent docs (shared).
 * Future: track panel-specific access history.
 */
export const panelRecentDocsAtom = Atom.family((panelId: string) =>
  Atom.make((get) => {
    const allRecent = get(recentDocsAtom);
    // For now, show all recent docs (shared pool)
    // Future: filter by panelId-specific access tracking
    return allRecent;
  })
);

// =============================================================================
// Shared Atoms (across all panels)
// =============================================================================

/**
 * Recent documents — shared across panels (localStorage persisted).
 */
export const recentDocsAtom = Atom.make<readonly RecentDoc[]>([]);

// =============================================================================
// Runtime
// =============================================================================

/**
 * Panel runtime for Effect operations.
 */
export const panelRuntimeAtom = Atom.runtime(
  Layer.mergeAll(CollaborationServiceLive)
);

// =============================================================================
// Pet Name Generator
// =============================================================================

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

export function generatePetName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
}

// =============================================================================
// Panel Operations
// =============================================================================

const STORAGE_KEY_RECENT_DOCS = 'tmnl:collab:recentDocs';
const MAX_RECENT_DOCS = 10;

/**
 * Panel-scoped operations.
 * Each operation takes panelId as first argument to scope mutations.
 */
export const panelOps = {
  /**
   * Connect panel to a document.
   */
  connect: panelRuntimeAtom.fn<{ panelId: string; docId: string }>()(
    (args, ctx) =>
      Effect.gen(function* () {
        const { panelId, docId } = args;
        const service = yield* CollaborationService;

        // Set connecting state for THIS panel only
        ctx.set(panelStatusAtom(panelId), 'connecting');
        ctx.set(panelDocIdAtom(panelId), docId);
        ctx.set(panelErrorAtom(panelId), null);

        console.log(`[panel-stx] Panel ${panelId} connecting to ${docId}`);

        const clientToken = yield* pipe(
          service.getClientToken(docId),
          Effect.tap((token) =>
            Effect.sync(() => {
              console.log(`[panel-stx] Panel ${panelId} got token:`, token);
            })
          ),
          Effect.tapError((err) =>
            Effect.sync(() => {
              console.error(`[panel-stx] Panel ${panelId} error:`, err);
              ctx.set(panelStatusAtom(panelId), 'error');
              ctx.set(panelErrorAtom(panelId), err.message);
            })
          )
        );

        // Set connected state for THIS panel
        ctx.set(panelStatusAtom(panelId), 'connected');
        ctx.set(panelClientTokenAtom(panelId), clientToken);

        return clientToken;
      })
  ),

  /**
   * Disconnect panel.
   */
  disconnect: panelRuntimeAtom.fn<{ panelId: string }>()((args, ctx) =>
    Effect.sync(() => {
      const { panelId } = args;
      ctx.set(panelStatusAtom(panelId), 'disconnected');
      ctx.set(panelDocIdAtom(panelId), null);
      ctx.set(panelClientTokenAtom(panelId), null);
      ctx.set(panelUsersAtom(panelId), []);
      ctx.set(panelErrorAtom(panelId), null);
      ctx.set(panelPetNameAtom(panelId), null);
      console.log(`[panel-stx] Panel ${panelId} disconnected`);
    })
  ),

  /**
   * Update connected users for a panel.
   */
  updateUsers: panelRuntimeAtom.fn<{
    panelId: string;
    users: readonly CollaborationUser[];
  }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(panelUsersAtom(args.panelId), args.users);
    })
  ),

  /**
   * Set pet name for panel's current document.
   */
  setPetName: panelRuntimeAtom.fn<{ panelId: string; petName: string }>()(
    (args, ctx) =>
      Effect.sync(() => {
        ctx.set(panelPetNameAtom(args.panelId), args.petName);
      })
  ),

  /**
   * Open document drawer for panel.
   */
  openDrawer: panelRuntimeAtom.fn<{ panelId: string }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(panelDrawerOpenAtom(args.panelId), true);
    })
  ),

  /**
   * Close document drawer for panel.
   */
  closeDrawer: panelRuntimeAtom.fn<{ panelId: string }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(panelDrawerOpenAtom(args.panelId), false);
    })
  ),

  // ===========================================================================
  // Document Registry (shared across panels)
  // ===========================================================================

  /**
   * Load recent documents from localStorage.
   */
  loadRecentDocs: panelRuntimeAtom.fn<void>()((_, ctx) =>
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
   * Add document to recent docs.
   */
  addToRecentDocs: panelRuntimeAtom.fn<{ docId: string; petName: string }>()(
    (args, ctx) =>
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
   * Remove document from recent docs.
   */
  removeFromRecentDocs: panelRuntimeAtom.fn<{ docId: string }>()((args, ctx) =>
    Effect.sync(() => {
      const recent = ctx(recentDocsAtom);
      const filtered = recent.filter((d) => d.docId !== args.docId);
      ctx.set(recentDocsAtom, filtered);
      localStorage.setItem(STORAGE_KEY_RECENT_DOCS, JSON.stringify(filtered));
      return filtered;
    })
  ),
};

// =============================================================================
// Hook Helpers
// =============================================================================

/**
 * Panel atoms type for use with useAtomValue.
 *
 * NOTE: We cast to AtomReact.Atom to satisfy useAtomValue's type signature.
 * The underlying atoms are from @effect-atom/atom but the hooks expect
 * the re-exported types from @effect-atom/atom-react.
 */
export interface PanelAtoms {
  status: AtomReact.Atom<ConnectionStatus>;
  docId: AtomReact.Atom<string | null>;
  clientToken: AtomReact.Atom<ClientToken | null>;
  error: AtomReact.Atom<string | null>;
  users: AtomReact.Atom<readonly CollaborationUser[]>;
  petName: AtomReact.Atom<string | null>;
  drawerOpen: AtomReact.Atom<boolean>;
  isConnected: AtomReact.Atom<boolean>;
  isConnecting: AtomReact.Atom<boolean>;
  userCount: AtomReact.Atom<number>;
  recentDocs: AtomReact.Atom<readonly RecentDoc[]>;
}

/**
 * Get all atoms for a specific panel.
 * Returns the atom instances (not values) for use with useAtomValue.
 */
export function getPanelAtoms(panelId: string): PanelAtoms {
  return {
    status: panelStatusAtom(
      panelId
    ) as unknown as AtomReact.Atom<ConnectionStatus>,
    docId: panelDocIdAtom(panelId) as unknown as AtomReact.Atom<string | null>,
    clientToken: panelClientTokenAtom(
      panelId
    ) as unknown as AtomReact.Atom<ClientToken | null>,
    error: panelErrorAtom(panelId) as unknown as AtomReact.Atom<string | null>,
    users: panelUsersAtom(panelId) as unknown as AtomReact.Atom<
      readonly CollaborationUser[]
    >,
    petName: panelPetNameAtom(panelId) as unknown as AtomReact.Atom<
      string | null
    >,
    drawerOpen: panelDrawerOpenAtom(
      panelId
    ) as unknown as AtomReact.Atom<boolean>,
    isConnected: panelIsConnectedAtom(
      panelId
    ) as unknown as AtomReact.Atom<boolean>,
    isConnecting: panelIsConnectingAtom(
      panelId
    ) as unknown as AtomReact.Atom<boolean>,
    userCount: panelUserCountAtom(panelId) as unknown as AtomReact.Atom<number>,
    recentDocs: panelRecentDocsAtom(panelId) as unknown as AtomReact.Atom<
      readonly RecentDoc[]
    >,
  };
}

/**
 * Create panel-scoped argument factories.
 * Returns arg objects bound to a specific panelId for use with useSetAtom.
 *
 * Usage:
 * ```ts
 * const args = createPanelArgs(panelId);
 * const doConnect = useSetAtom(panelOps.connect as any);
 * doConnect(args.connect('my-doc-id'));
 * ```
 */
export function createPanelArgs(panelId: string) {
  return {
    connect: (docId: string) => ({ panelId, docId }),
    disconnect: () => ({ panelId }),
    updateUsers: (users: readonly CollaborationUser[]) => ({ panelId, users }),
    setPetName: (petName: string) => ({ panelId, petName }),
    openDrawer: () => ({ panelId }),
    closeDrawer: () => ({ panelId }),
  } as const;
}
