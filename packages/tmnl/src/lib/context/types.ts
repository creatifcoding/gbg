/**
 * Recontextualization System Types
 *
 * Types for managing dynamic context injection in agentic workflows.
 */

import type { ContextEntry, ZonBlock } from './zon'

/**
 * A loaded context file with parsed ZON metadata
 */
export interface LoadedContext {
  /** Context entry metadata */
  entry: ContextEntry
  /** Raw file content */
  content: string
  /** Extracted ZON blocks */
  zonBlocks: ZonBlock[]
  /** When this context was loaded */
  loadedAt: Date
}

/**
 * Current state of the recontextualization system
 */
export interface RecontextState {
  /** Map of path → loaded context */
  contexts: Map<string, LoadedContext>
  /** Context index entries (sorted by priority) */
  index: ContextEntry[]
  /** When the index was last refreshed */
  lastRefresh: Date | null
}

/**
 * Operations available on the recontextualization system
 */
export interface RecontextOps {
  /** Load a single context file by path */
  load: (path: string) => Promise<void>
  /** Load all CLAUDE.*.md files for a domain */
  loadDomain: (domain: string) => Promise<void>
  /** Refresh the context index from IDEA-MILL.org */
  refresh: () => Promise<void>
  /** Get the current context index */
  getIndex: () => ContextEntry[]
  /** Search across loaded contexts */
  search: (term: string) => Promise<SearchResult[]>
}

/**
 * Search result from context search
 */
export interface SearchResult {
  /** File path where matches were found */
  path: string
  /** Matching lines */
  matches: string[]
}

/**
 * Configuration for the RecontextProvider
 */
export interface RecontextConfig {
  /** Path to the context index file (default: assets/documents/IDEA-MILL.org) */
  indexPath?: string
  /** Auto-refresh index on mount (default: true) */
  autoRefresh?: boolean
  /** Base path for resolving relative paths */
  basePath?: string
}
