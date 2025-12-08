/**
 * Recontextualization Provider
 *
 * React context provider for dynamic context injection in agentic workflows.
 * Manages loading, parsing, and accessing context files with ZON metadata.
 */

import * as React from 'react'
import { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react'
import type { RecontextState, RecontextOps, LoadedContext, RecontextConfig, SearchResult } from './types'
import { extractZonBlocks, extractContextEntries, type ContextEntry } from './zon'

// ---------------------------------------------------------------------------
// Context Definition
// ---------------------------------------------------------------------------

interface RecontextContextValue {
  state: RecontextState
  ops: RecontextOps
}

const RecontextContext = createContext<RecontextContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

interface RecontextProviderProps extends RecontextConfig {
  children: React.ReactNode
}

export function RecontextProvider({
  children,
  indexPath = 'assets/documents/IDEA-MILL.org',
  autoRefresh = true,
  basePath = '',
}: RecontextProviderProps) {
  const [state, setState] = useState<RecontextState>({
    contexts: new Map(),
    index: [],
    lastRefresh: null,
  })

  // Resolve path with base path
  const resolvePath = useCallback(
    (path: string) => {
      if (path.startsWith('/') || path.startsWith('http')) {
        return path
      }
      return basePath ? `${basePath}/${path}` : path
    },
    [basePath]
  )

  // Load and parse a context file
  const load = useCallback(
    async (path: string) => {
      try {
        const resolvedPath = resolvePath(path)
        const response = await fetch(resolvedPath)

        if (!response.ok) {
          console.warn(`[recontext] Failed to load ${path}: ${response.status}`)
          return
        }

        const content = await response.text()
        const zonBlocks = extractZonBlocks(content)

        const entry: ContextEntry = {
          id: path.split('/').pop()?.replace(/\.[^.]+$/, '') || path,
          path,
          scope: 'task',
          priority: 5,
        }

        const loaded: LoadedContext = {
          entry,
          content,
          zonBlocks,
          loadedAt: new Date(),
        }

        setState((prev) => ({
          ...prev,
          contexts: new Map(prev.contexts).set(path, loaded),
        }))
      } catch (err) {
        console.error(`[recontext] Failed to load ${path}:`, err)
      }
    },
    [resolvePath]
  )

  // Load all CLAUDE.*.md files for a domain
  const loadDomain = useCallback(
    async (domain: string) => {
      // In browser context, we construct known paths
      // A full implementation would use a file listing API
      const paths = [`src/lib/${domain}/CLAUDE.md`, `src/lib/${domain}/CLAUDE.${domain}.md`]

      await Promise.all(paths.map((p) => load(p).catch(() => {})))
    },
    [load]
  )

  // Refresh the context index from IDEA-MILL.org
  const refresh = useCallback(async () => {
    try {
      const resolvedPath = resolvePath(indexPath)
      const response = await fetch(resolvedPath)

      if (!response.ok) {
        console.warn(`[recontext] Failed to refresh index from ${indexPath}: ${response.status}`)
        return
      }

      const content = await response.text()
      const zonBlocks = extractZonBlocks(content)
      const index = extractContextEntries(zonBlocks)

      setState((prev) => ({
        ...prev,
        index,
        lastRefresh: new Date(),
      }))
    } catch (err) {
      console.error('[recontext] Failed to refresh index:', err)
    }
  }, [indexPath, resolvePath])

  // Get current context index
  const getIndex = useCallback(() => state.index, [state.index])

  // Search across loaded contexts
  const search = useCallback(
    async (term: string): Promise<SearchResult[]> => {
      const results: SearchResult[] = []
      const regex = new RegExp(term, 'gi')

      for (const [path, ctx] of state.contexts) {
        const lines = ctx.content.split('\n')
        const matches = lines.filter((line) => regex.test(line))
        if (matches.length > 0) {
          results.push({ path, matches })
        }
      }

      return results
    },
    [state.contexts]
  )

  // Memoize ops to prevent unnecessary re-renders
  const ops: RecontextOps = useMemo(
    () => ({
      load,
      loadDomain,
      refresh,
      getIndex,
      search,
    }),
    [load, loadDomain, refresh, getIndex, search]
  )

  // Auto-refresh index on mount
  useEffect(() => {
    if (autoRefresh) {
      refresh()
    }
  }, [autoRefresh, refresh])

  const value = useMemo(() => ({ state, ops }), [state, ops])

  return <RecontextContext.Provider value={value}>{children}</RecontextContext.Provider>
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access the full recontext state and operations
 *
 * @throws If used outside of RecontextProvider
 */
export function useRecontext(): RecontextContextValue {
  const ctx = useContext(RecontextContext)
  if (!ctx) {
    throw new Error('useRecontext must be used within RecontextProvider')
  }
  return ctx
}

/**
 * Access just the context index (sorted by priority)
 */
export function useContextIndex(): ContextEntry[] {
  const { state } = useRecontext()
  return state.index
}

/**
 * Access all loaded contexts
 */
export function useLoadedContexts(): LoadedContext[] {
  const { state } = useRecontext()
  return Array.from(state.contexts.values())
}

/**
 * Access a specific loaded context by path
 */
export function useLoadedContext(path: string): LoadedContext | undefined {
  const { state } = useRecontext()
  return state.contexts.get(path)
}

/**
 * Access recontext operations only
 */
export function useRecontextOps(): RecontextOps {
  const { ops } = useRecontext()
  return ops
}
