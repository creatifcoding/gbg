/**
 * Theia IDE State (STX)
 *
 * Atom-based state management for Theia IDE panels.
 * Uses Atom.family for panel-scoped state isolation.
 *
 * @module lib/theia/theia-stx
 */

import { Atom, Registry } from '@effect-atom/atom';
import { Atom as AtomReact } from '@effect-atom/atom-react';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Registry
// =============================================================================

export const theiaRegistry = Registry.make();

// =============================================================================
// Types
// =============================================================================

export type TheiaStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TheiaServerStatus {
  running: boolean;
  pid: number | null;
  port: number;
  url: string;
}

// =============================================================================
// Global Atoms (shared across all Theia panels)
// =============================================================================

/**
 * Global Theia server status.
 * Only one server instance runs, shared by all panels.
 */
export const theiaServerStatusAtom = Atom.make<TheiaStatus>('stopped');

/**
 * Server URL when running.
 */
export const theiaServerUrlAtom = Atom.make<string | null>(null);

/**
 * Server PID when running.
 */
export const theiaServerPidAtom = Atom.make<number | null>(null);

/**
 * Server port (default 3035).
 */
export const theiaServerPortAtom = Atom.make<number>(3035);

/**
 * Last error message.
 */
export const theiaServerErrorAtom = Atom.make<string | null>(null);

// =============================================================================
// Panel-Scoped Atoms (per embedded panel)
// =============================================================================

/**
 * Whether this panel is "bounced" to a separate window.
 */
export const panelBouncedAtom = Atom.family((panelId: string) =>
  Atom.make<boolean>(false)
);

/**
 * Whether this panel's iframe is loaded.
 */
export const panelLoadedAtom = Atom.family((panelId: string) =>
  Atom.make<boolean>(false)
);

/**
 * Current workspace path for this panel.
 */
export const panelWorkspaceAtom = Atom.family((panelId: string) =>
  Atom.make<string | null>(null)
);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Is Theia server ready for iframe embedding?
 */
export const theiaReadyAtom = Atom.make((get) =>
  get(theiaServerStatusAtom) === 'running' && get(theiaServerUrlAtom) !== null
);

// =============================================================================
// Operations (Tauri IPC)
// =============================================================================

export const theiaOps = {
  /**
   * Start the Theia IDE server.
   */
  start: async (): Promise<void> => {
    try {
      theiaRegistry.set(theiaServerStatusAtom, 'starting');
      theiaRegistry.set(theiaServerErrorAtom, null);

      const pid = await invoke<number>('theia_server_start');

      theiaRegistry.set(theiaServerStatusAtom, 'running');
      theiaRegistry.set(theiaServerPidAtom, pid);
      theiaRegistry.set(
        theiaServerUrlAtom,
        `http://127.0.0.1:${theiaRegistry.get(theiaServerPortAtom)}`
      );

      console.log('[theia-stx] Server started, pid:', pid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      theiaRegistry.set(theiaServerStatusAtom, 'error');
      theiaRegistry.set(theiaServerErrorAtom, message);
      console.error('[theia-stx] Failed to start server:', message);
      throw err;
    }
  },

  /**
   * Stop the Theia IDE server.
   */
  stop: async (): Promise<void> => {
    try {
      await invoke('theia_server_stop');

      theiaRegistry.set(theiaServerStatusAtom, 'stopped');
      theiaRegistry.set(theiaServerPidAtom, null);
      theiaRegistry.set(theiaServerUrlAtom, null);

      console.log('[theia-stx] Server stopped');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      theiaRegistry.set(theiaServerErrorAtom, message);
      console.error('[theia-stx] Failed to stop server:', message);
      throw err;
    }
  },

  /**
   * Restart the Theia IDE server.
   */
  restart: async (): Promise<void> => {
    try {
      theiaRegistry.set(theiaServerStatusAtom, 'starting');

      const pid = await invoke<number>('theia_server_restart');

      theiaRegistry.set(theiaServerStatusAtom, 'running');
      theiaRegistry.set(theiaServerPidAtom, pid);

      console.log('[theia-stx] Server restarted, pid:', pid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      theiaRegistry.set(theiaServerStatusAtom, 'error');
      theiaRegistry.set(theiaServerErrorAtom, message);
      throw err;
    }
  },

  /**
   * Refresh status from Tauri.
   */
  refreshStatus: async (): Promise<void> => {
    try {
      const status = await invoke<TheiaServerStatus>('theia_server_status');

      if (status.running) {
        theiaRegistry.set(theiaServerStatusAtom, 'running');
        theiaRegistry.set(theiaServerPidAtom, status.pid);
        theiaRegistry.set(theiaServerUrlAtom, status.url);
        theiaRegistry.set(theiaServerPortAtom, status.port);
      } else {
        theiaRegistry.set(theiaServerStatusAtom, 'stopped');
        theiaRegistry.set(theiaServerPidAtom, null);
        theiaRegistry.set(theiaServerUrlAtom, null);
      }
    } catch (err) {
      console.error('[theia-stx] Failed to refresh status:', err);
    }
  },

  /**
   * Bounce panel to separate window.
   */
  bounce: async (panelId: string): Promise<void> => {
    // TODO: Implement WebviewWindow creation
    theiaRegistry.set(panelBouncedAtom(panelId), true);
    console.log('[theia-stx] Panel bounced:', panelId);
  },

  /**
   * Unbounce panel back to embedded.
   */
  unbounce: async (panelId: string): Promise<void> => {
    // TODO: Close WebviewWindow
    theiaRegistry.set(panelBouncedAtom(panelId), false);
    console.log('[theia-stx] Panel unbounced:', panelId);
  },

  /**
   * Set workspace for panel.
   */
  setWorkspace: (panelId: string, path: string | null): void => {
    theiaRegistry.set(panelWorkspaceAtom(panelId), path);
  },

  /**
   * Mark panel iframe as loaded.
   */
  setLoaded: (panelId: string, loaded: boolean): void => {
    theiaRegistry.set(panelLoadedAtom(panelId), loaded);
  },
};

// =============================================================================
// Hook Helpers
// =============================================================================

export interface TheiaAtoms {
  status: AtomReact.Atom<TheiaStatus>;
  url: AtomReact.Atom<string | null>;
  pid: AtomReact.Atom<number | null>;
  port: AtomReact.Atom<number>;
  error: AtomReact.Atom<string | null>;
  ready: AtomReact.Atom<boolean>;
}

export function getTheiaAtoms(): TheiaAtoms {
  return {
    status: theiaServerStatusAtom as unknown as AtomReact.Atom<TheiaStatus>,
    url: theiaServerUrlAtom as unknown as AtomReact.Atom<string | null>,
    pid: theiaServerPidAtom as unknown as AtomReact.Atom<number | null>,
    port: theiaServerPortAtom as unknown as AtomReact.Atom<number>,
    error: theiaServerErrorAtom as unknown as AtomReact.Atom<string | null>,
    ready: theiaReadyAtom as unknown as AtomReact.Atom<boolean>,
  };
}

export interface TheiaPanelAtoms {
  bounced: AtomReact.Atom<boolean>;
  loaded: AtomReact.Atom<boolean>;
  workspace: AtomReact.Atom<string | null>;
}

export function getTheiaPanelAtoms(panelId: string): TheiaPanelAtoms {
  return {
    bounced: panelBouncedAtom(panelId) as unknown as AtomReact.Atom<boolean>,
    loaded: panelLoadedAtom(panelId) as unknown as AtomReact.Atom<boolean>,
    workspace: panelWorkspaceAtom(
      panelId
    ) as unknown as AtomReact.Atom<string | null>,
  };
}
