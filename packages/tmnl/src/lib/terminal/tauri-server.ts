/**
 * Tauri Terminal Server Integration
 *
 * TypeScript bindings for the Rust-managed terminal server process.
 * The server is spawned and managed by Tauri as a child process.
 *
 * @example
 * ```tsx
 * import { useTerminalServer } from '@/lib/terminal';
 *
 * function TerminalApp() {
 *   const server = useTerminalServer();
 *
 *   return (
 *     <div>
 *       <p>Status: {server.status?.running ? 'Running' : 'Stopped'}</p>
 *       <p>Backend: {server.status?.backend}</p>
 *       <button onClick={() => server.start('ssh')}>Start SSH</button>
 *       <button onClick={server.stop}>Stop</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

/** Backend type for the terminal server */
export type TerminalBackend = 'pty' | 'ssh';

/** Status of the terminal server */
export interface TerminalServerStatus {
  running: boolean;
  backend: TerminalBackend | null;
  pid: number | null;
  port: number;
}

// =============================================================================
// TAURI COMMANDS
// =============================================================================

/**
 * Start the terminal server with the specified backend
 * @param backend - 'pty' (default) or 'ssh'
 * @returns Process ID of the started server
 */
export async function startTerminalServer(
  backend: TerminalBackend = 'pty'
): Promise<number> {
  return invoke<number>('terminal_server_start', { backend });
}

/**
 * Stop the terminal server
 */
export async function stopTerminalServer(): Promise<void> {
  return invoke('terminal_server_stop');
}

/**
 * Get the current status of the terminal server
 */
export async function getTerminalServerStatus(): Promise<TerminalServerStatus> {
  return invoke<TerminalServerStatus>('terminal_server_status');
}

/**
 * Restart the terminal server, optionally with a different backend
 * @param backend - New backend to use (defaults to current backend)
 * @returns Process ID of the restarted server
 */
export async function restartTerminalServer(
  backend?: TerminalBackend
): Promise<number> {
  return invoke<number>('terminal_server_restart', { backend });
}

// =============================================================================
// REACT HOOK
// =============================================================================

export interface UseTerminalServerReturn {
  /** Current server status */
  status: TerminalServerStatus | null;
  /** Whether status is being loaded */
  loading: boolean;
  /** Last error message */
  error: string | null;
  /** Start the server */
  start: (backend?: TerminalBackend) => Promise<void>;
  /** Stop the server */
  stop: () => Promise<void>;
  /** Restart the server */
  restart: (backend?: TerminalBackend) => Promise<void>;
  /** Refresh status */
  refresh: () => Promise<void>;
}

/**
 * React hook for managing the terminal server
 *
 * @param autoRefresh - Automatically refresh status on interval (ms), 0 to disable
 */
export function useTerminalServer(autoRefresh = 5000): UseTerminalServerReturn {
  const [status, setStatus] = useState<TerminalServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const newStatus = await getTerminalServerStatus();
      setStatus(newStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const start = useCallback(
    async (backend: TerminalBackend = 'pty') => {
      setLoading(true);
      setError(null);
      try {
        await startTerminalServer(backend);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  const stop = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await stopTerminalServer();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const restart = useCallback(
    async (backend?: TerminalBackend) => {
      setLoading(true);
      setError(null);
      try {
        await restartTerminalServer(backend);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  // Initial fetch
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh <= 0) return;

    const interval = setInterval(refresh, autoRefresh);
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  return {
    status,
    loading,
    error,
    start,
    stop,
    restart,
    refresh,
  };
}
