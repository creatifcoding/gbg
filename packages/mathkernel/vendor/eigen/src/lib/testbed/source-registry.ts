/**
 * Source Registry
 *
 * Runtime access to extracted component sources from the Vite plugin.
 * Uses the virtual module `virtual:component-sources`.
 *
 * @example
 * ```tsx
 * import { getComponentSource, getAllSources } from '@/lib/testbed/source-registry'
 *
 * // Get source for a specific component
 * const source = getComponentSource('rvn-button-primary')
 *
 * // Get all sources
 * const allSources = getAllSources()
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Component source metadata extracted at build time
 */
export interface ComponentSourceMeta {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Extracted JSX source code */
  source: string
  /** Source file path (relative to project root) */
  filePath: string
  /** Line number in source file */
  lineNumber: number
}

// =============================================================================
// Virtual Module Import (with fallback for dev mode)
// =============================================================================

/**
 * Sources loaded from the virtual module.
 * In development, this may be populated lazily.
 */
let sourcesCache: Record<string, ComponentSourceMeta> | null = null

/**
 * Load sources from virtual module.
 * Returns empty object if not available (e.g., during SSR or before build).
 */
async function loadSources(): Promise<Record<string, ComponentSourceMeta>> {
  if (sourcesCache !== null) {
    return sourcesCache
  }

  try {
    // Dynamic import to handle cases where virtual module isn't available
    const module = await import('virtual:component-sources')
    sourcesCache = module.sources ?? module.default ?? {}
    return sourcesCache as Record<string, ComponentSourceMeta>
  } catch (e) {
    // Virtual module not available (SSR, test environment, etc.)
    console.warn(
      '[source-registry] virtual:component-sources not available, using empty sources'
    )
    sourcesCache = {}
    return sourcesCache
  }
}

/**
 * Get sources synchronously (uses cached value)
 */
function getSourcesSync(): Record<string, ComponentSourceMeta> {
  return sourcesCache ?? {}
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get component source code by id
 *
 * @param id - Component identifier (from ComponentBox id prop)
 * @returns Source code string or null if not found
 */
export function getComponentSource(id: string): string | null {
  const sources = getSourcesSync()
  return sources[id]?.source ?? null
}

/**
 * Get component source metadata by id
 *
 * @param id - Component identifier (from ComponentBox id prop)
 * @returns Source metadata or null if not found
 */
export function getComponentSourceMeta(id: string): ComponentSourceMeta | null {
  const sources = getSourcesSync()
  return sources[id] ?? null
}

/**
 * Get all component sources
 *
 * @returns Record of all sources keyed by id
 */
export function getAllSources(): Record<string, ComponentSourceMeta> {
  return { ...getSourcesSync() }
}

/**
 * Get all component ids
 *
 * @returns Array of component ids
 */
export function getComponentIds(): string[] {
  return Object.keys(getSourcesSync())
}

/**
 * Check if a component source exists
 *
 * @param id - Component identifier
 * @returns true if source exists
 */
export function hasComponentSource(id: string): boolean {
  const sources = getSourcesSync()
  return id in sources
}

/**
 * Initialize source registry (call early in app lifecycle)
 * This pre-loads sources for synchronous access.
 */
export async function initSourceRegistry(): Promise<void> {
  await loadSources()
}

/**
 * Get sources by file path
 *
 * @param filePath - Relative file path to filter by
 * @returns Array of sources from that file
 */
export function getSourcesByFile(filePath: string): ComponentSourceMeta[] {
  const sources = getSourcesSync()
  return Object.values(sources).filter((s) => s.filePath === filePath)
}

// =============================================================================
// React Hook (for reactive updates if needed)
// =============================================================================

import { useState, useEffect } from 'react'

/**
 * React hook to access component source
 *
 * @param id - Component identifier
 * @returns Source code string or null
 */
export function useComponentSource(id: string | undefined): string | null {
  const [source, setSource] = useState<string | null>(() =>
    id ? getComponentSource(id) : null
  )

  useEffect(() => {
    if (!id) {
      setSource(null)
      return
    }

    // Load sources if not cached
    loadSources().then(() => {
      setSource(getComponentSource(id))
    })
  }, [id])

  return source
}

/**
 * React hook to access component source metadata
 *
 * @param id - Component identifier
 * @returns Source metadata or null
 */
export function useComponentSourceMeta(
  id: string | undefined
): ComponentSourceMeta | null {
  const [meta, setMeta] = useState<ComponentSourceMeta | null>(() =>
    id ? getComponentSourceMeta(id) : null
  )

  useEffect(() => {
    if (!id) {
      setMeta(null)
      return
    }

    // Load sources if not cached
    loadSources().then(() => {
      setMeta(getComponentSourceMeta(id))
    })
  }, [id])

  return meta
}
