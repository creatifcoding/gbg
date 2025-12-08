/**
 * Recontextualization Service - Effect-Atom Bindings
 *
 * Provides Effect-based services and atoms for the recontextualization system.
 * Uses the canonical Effect.Service pattern with Atom.runtime for React integration.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import { Atom } from '@effect-atom/atom'
import type { RecontextState, LoadedContext } from '../types'
import { extractZonBlocks, extractContextEntries, type ContextEntry } from '../zon'

// ---------------------------------------------------------------------------
// Service Definition
// ---------------------------------------------------------------------------

/**
 * RecontextService provides Effect-based context injection operations
 */
export class RecontextService extends Context.Tag('tmnl/context/RecontextService')<
  RecontextService,
  {
    /** Load a context file by path */
    readonly load: (path: string) => Effect.Effect<LoadedContext>
    /** Load all CLAUDE.*.md files for a domain */
    readonly loadDomain: (domain: string) => Effect.Effect<void>
    /** Refresh the context index */
    readonly refresh: () => Effect.Effect<ContextEntry[]>
    /** Get current state */
    readonly getState: () => Effect.Effect<RecontextState>
  }
>() {}

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

const makeRecontextService = Effect.gen(function* () {
  const stateRef = yield* Ref.make<RecontextState>({
    contexts: new Map(),
    index: [],
    lastRefresh: null,
  })

  const load = (path: string) =>
    Effect.gen(function* () {
      // In a real implementation, this would use Effect.tryPromise with fetch
      // For now, we create a placeholder that can be extended
      const content = yield* Effect.tryPromise({
        try: async () => {
          const response = await fetch(path)
          if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`)
          return response.text()
        },
        catch: (e) => new Error(`Failed to load ${path}: ${e}`),
      }).pipe(
        Effect.catchAll(() => Effect.succeed('')) // Fallback to empty on error
      )

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

      yield* Ref.update(stateRef, (prev) => ({
        ...prev,
        contexts: new Map(prev.contexts).set(path, loaded),
      }))

      return loaded
    }).pipe(Effect.withSpan('RecontextService.load', { attributes: { path } }))

  const loadDomain = (domain: string) =>
    Effect.gen(function* () {
      const paths = [`src/lib/${domain}/CLAUDE.md`, `src/lib/${domain}/CLAUDE.${domain}.md`]
      yield* Effect.all(
        paths.map((p) => load(p).pipe(Effect.ignore)),
        { concurrency: 'unbounded' }
      )
    }).pipe(Effect.withSpan('RecontextService.loadDomain', { attributes: { domain } }))

  const refresh = () =>
    Effect.gen(function* () {
      const indexPath = 'assets/documents/IDEA-MILL.org'

      const content = yield* Effect.tryPromise({
        try: async () => {
          const response = await fetch(indexPath)
          if (!response.ok) throw new Error(`Failed to refresh index: ${response.status}`)
          return response.text()
        },
        catch: (e) => new Error(`Failed to refresh index: ${e}`),
      }).pipe(
        Effect.catchAll(() => Effect.succeed('')) // Fallback to empty
      )

      const zonBlocks = extractZonBlocks(content)
      const index = extractContextEntries(zonBlocks)

      yield* Ref.update(stateRef, (prev) => ({
        ...prev,
        index,
        lastRefresh: new Date(),
      }))

      return index
    }).pipe(Effect.withSpan('RecontextService.refresh'))

  const getState = () => Ref.get(stateRef)

  return { load, loadDomain, refresh, getState }
})

/**
 * Live layer for RecontextService
 */
export const RecontextServiceLive = Layer.effect(RecontextService, makeRecontextService)

// ---------------------------------------------------------------------------
// Runtime Atom
// ---------------------------------------------------------------------------

/**
 * Runtime atom for the recontextualization system
 *
 * Usage:
 * ```tsx
 * const stateResult = useAtomValue(contextIndexAtom)
 * if (Result.isSuccess(stateResult)) {
 *   const index = stateResult.value
 * }
 * ```
 */
export const recontextRuntimeAtom = Atom.runtime(RecontextServiceLive)

// ---------------------------------------------------------------------------
// State Atoms
// ---------------------------------------------------------------------------

/**
 * Atom for the context index (sorted by priority)
 */
export const contextIndexAtom = recontextRuntimeAtom.atom(
  Effect.gen(function* () {
    const service = yield* RecontextService
    const state = yield* service.getState()
    return state.index
  })
)

/**
 * Atom for all loaded contexts
 */
export const loadedContextsAtom = recontextRuntimeAtom.atom(
  Effect.gen(function* () {
    const service = yield* RecontextService
    const state = yield* service.getState()
    return Array.from(state.contexts.values())
  })
)

/**
 * Atom for the last refresh timestamp
 */
export const lastRefreshAtom = recontextRuntimeAtom.atom(
  Effect.gen(function* () {
    const service = yield* RecontextService
    const state = yield* service.getState()
    return state.lastRefresh
  })
)

// ---------------------------------------------------------------------------
// Operation Atoms
// ---------------------------------------------------------------------------

/**
 * Operation atoms for mutating recontext state
 */
export const recontextOpsAtom = {
  /**
   * Load a context file
   */
  load: recontextRuntimeAtom.fn((path: string) =>
    Effect.gen(function* () {
      const service = yield* RecontextService
      return yield* service.load(path)
    })
  ),

  /**
   * Load all context files for a domain
   */
  loadDomain: recontextRuntimeAtom.fn((domain: string) =>
    Effect.gen(function* () {
      const service = yield* RecontextService
      yield* service.loadDomain(domain)
    })
  ),

  /**
   * Refresh the context index
   */
  refresh: recontextRuntimeAtom.fn(() =>
    Effect.gen(function* () {
      const service = yield* RecontextService
      return yield* service.refresh()
    })
  ),
}
