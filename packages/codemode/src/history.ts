/**
 * RLM History — Session-scoped REPL trace
 *
 * Tracks ms tool invocations within a session. Each call records
 * { code, result (truncated), timestamp }. History is persisted via
 * pi.appendEntry('ms-history', entry) and reconstructed from
 * ctx.sessionManager.getBranch() on session lifecycle events.
 *
 * Extracted from index.ts for testability.
 *
 * @module
 */

// ─── Types ───────────────────────────────────────────────────

export interface HistoryEntry {
  code: string
  result: string
  timestamp: string
}

/** Minimal session entry shape for reconstruction (matches pi's CustomEntry) */
export interface SessionEntry {
  type: string
  customType?: string
  data?: any
}

// ─── Constants ───────────────────────────────────────────────

export const HISTORY_CUSTOM_TYPE = 'cm-history'
export const RESULT_TRUNCATE_LENGTH = 500

// ─── History Manager ─────────────────────────────────────────

export interface HistoryManager {
  /** Record a new ms invocation */
  record(code: string, result: string): HistoryEntry
  /** Get last N entries (default 10) */
  get(n?: number): HistoryEntry[]
  /** Reconstruct history from session entries (e.g., on session_start) */
  reconstruct(entries: SessionEntry[]): void
  /** Current count */
  count(): number
  /** Clear all entries (used in tests) */
  clear(): void
}

export function createHistoryManager(): HistoryManager {
  let _entries: HistoryEntry[] = []

  return {
    record(code: string, result: string): HistoryEntry {
      const entry: HistoryEntry = {
        code,
        result: result.length > RESULT_TRUNCATE_LENGTH
          ? result.slice(0, RESULT_TRUNCATE_LENGTH - 3) + '...'
          : result,
        timestamp: new Date().toISOString(),
      }
      _entries.push(entry)
      return entry
    },

    get(n?: number): HistoryEntry[] {
      const limit = n ?? 10
      return _entries.slice(-limit)
    },

    reconstruct(entries: SessionEntry[]): void {
      _entries = []
      for (const entry of entries) {
        if (entry.type === 'custom' && entry.customType === HISTORY_CUSTOM_TYPE) {
          const data = entry.data as HistoryEntry | undefined
          if (data?.code) _entries.push(data)
        }
      }
    },

    count(): number {
      return _entries.length
    },

    clear(): void {
      _entries = []
    },
  }
}

// ─── Context Builder ─────────────────────────────────────────

export interface ProjectContext {
  skills: { count: number; names: string[] }
  collections: { name: string; count: number }[]
  cwd: string
  project: string
}

/**
 * Build a lazy project context snapshot.
 * Accepts provider functions so it doesn't depend on api/store directly.
 */
export function buildContext(
  cwd: string,
  getSkillNames: () => string[],
  getCollections: () => { name: string; count: number }[],
): ProjectContext {
  const names = getSkillNames()
  return {
    skills: { count: names.length, names },
    collections: getCollections(),
    cwd,
    project: cwd.split('/').pop() ?? '',
  }
}
