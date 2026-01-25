/**
 * useCommandSearch Hook
 *
 * Stream-first command search using FlexSearchDriver from @/lib/search.
 * Follows DataManager testbed patterns:
 * - Direct driver pattern with useState
 * - Effect.runFork for non-blocking search
 * - Fiber cancellation on new queries
 * - Result type for state management
 *
 * @module
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Effect, Stream, Fiber, Chunk, Cause } from 'effect'
import * as Result from '@effect-atom/atom/Result'
import {
  createFlexSearchDriver,
  withMinScore,
  type CommandSearchService,
  type CommandSearchItem,
  type SearchResult,
} from '@/lib/search'
import { getRegisteredCommands, getDefaultBindings } from '../decorators'
import type { Command } from '../types'

// Re-export Result for consumers
export { Result }

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandSearchResult {
  readonly item: CommandSearchItem
  readonly score: number
}

export interface UseCommandSearchReturn {
  /** Current search results as Result type */
  readonly results: Result.Result<readonly CommandSearchResult[], Error>
  /** Whether driver is ready */
  readonly isReady: boolean
  /** Whether search is in progress */
  readonly isSearching: boolean
  /** Execute a search query */
  readonly search: (query: string) => void
  /** Cancel current search */
  readonly cancel: () => void
  /** Total indexed commands */
  readonly indexedCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Commands to SearchItems
// ─────────────────────────────────────────────────────────────────────────────

function commandToSearchItem(command: Command): CommandSearchItem {
  // Get keybinding for this command
  const bindings = getDefaultBindings()
  const binding = bindings.find(b => b.commandId === command.id)

  return {
    id: command.id,
    name: command.name,
    description: command.description,
    category: command.category,
    scope: command.scope,
    keys: binding?.keys,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for command palette search using FlexSearchDriver.
 *
 * @example
 * ```tsx
 * const { results, search, isReady, isSearching } = useCommandSearch()
 *
 * // Search on input change
 * const handleInput = (query: string) => {
 *   search(query)
 * }
 *
 * // Render results using Result pattern
 * return Result.builder(results)
 *   .onInitial(() => <Loading />)
 *   .onSuccess((items) => <CommandList items={items} />)
 *   .onFailure((cause) => <Error cause={cause} />)
 *   .render()
 * ```
 */
export function useCommandSearch(): UseCommandSearchReturn {
  // Driver instance persisted in state (DataManager pattern)
  const [driver, setDriver] = useState<CommandSearchService | null>(null)
  const [indexedCount, setIndexedCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<Result.Result<readonly CommandSearchResult[], Error>>(
    Result.initial<readonly CommandSearchResult[], Error>()
  )

  // Fiber ref for cancellation
  const fiberRef = useRef<Fiber.RuntimeFiber<Chunk.Chunk<SearchResult<CommandSearchItem>>, Error> | null>(null)

  // Initialize driver and index commands on mount
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Create FlexSearch driver
        const flex = await Effect.runPromise(createFlexSearchDriver<CommandSearchItem>())

        if (cancelled) return

        // Get all registered commands
        const commands = getRegisteredCommands()
        const searchItems = Array.from(commands.values()).map(commandToSearchItem)

        // Index commands
        await Effect.runPromise(
          flex.index(searchItems, {
            fields: ['name', 'description', 'category', 'keys'],
          })
        )

        if (cancelled) return

        setDriver(flex)
        setIndexedCount(searchItems.length)

        // Set initial results (all commands, sorted by name)
        const allResults = searchItems.map(item => ({ item, score: 1 }))
        setResults(Result.success(allResults))
      } catch (err) {
        if (!cancelled) {
          setResults(Result.fail(err instanceof Error ? err : new Error(String(err))))
        }
      }
    }

    init()

    return () => {
      cancelled = true
      // Cancel any in-flight search
      if (fiberRef.current) {
        Effect.runPromise(Fiber.interrupt(fiberRef.current))
      }
    }
  }, [])

  // Search function
  const search = useCallback((query: string) => {
    if (!driver) return

    // Cancel previous search
    if (fiberRef.current) {
      Effect.runPromise(Fiber.interrupt(fiberRef.current))
      fiberRef.current = null
    }

    // Empty query = show all commands
    if (!query.trim()) {
      const commands = getRegisteredCommands()
      const searchItems = Array.from(commands.values()).map(commandToSearchItem)
      const allResults = searchItems.map(item => ({ item, score: 1 }))
      setResults(Result.success(allResults))
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    // Mark as waiting while preserving previous results
    setResults(prev => Result.waiting(prev))

    // Fork the search stream (non-blocking)
    const searchEffect = Effect.gen(function* () {
      const stream = driver.search(query)
      const collected = yield* stream.pipe(
        withMinScore(0.1),
        Stream.take(50),
        Stream.runCollect
      )
      return Chunk.toReadonlyArray(collected).map(r => ({
        item: r.item,
        score: r.score,
      }))
    })

    // Run in fiber for cancellation support
    Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(searchEffect)
        fiberRef.current = fiber as any
        const searchResults = yield* Fiber.join(fiber)
        return searchResults
      })
    )
      .then(searchResults => {
        setResults(Result.success(searchResults))
        setIsSearching(false)
        fiberRef.current = null
      })
      .catch(err => {
        // Don't set error if interrupted (user cancelled)
        if (err?._tag !== 'Interrupt') {
          setResults(Result.fail(err instanceof Error ? err : new Error(String(err))))
        }
        setIsSearching(false)
        fiberRef.current = null
      })
  }, [driver])

  // Cancel function
  const cancel = useCallback(() => {
    if (fiberRef.current) {
      Effect.runPromise(Fiber.interrupt(fiberRef.current))
      fiberRef.current = null
      setIsSearching(false)
    }
  }, [])

  return {
    results,
    isReady: driver !== null,
    isSearching,
    search,
    cancel,
    indexedCount,
  }
}

export default useCommandSearch
