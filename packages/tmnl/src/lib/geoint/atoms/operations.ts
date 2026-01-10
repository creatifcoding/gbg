/**
 * GEOINT Search Operations - Atom-based Effect Operations
 *
 * Integrates DurableStreams with effect-atom for reactive search state.
 * Uses runtimeAtom.fn pattern for Effect operations that mutate atoms.
 *
 * Key patterns:
 * - ctx(atom) for sync reads inside Effect
 * - ctx.set(atom, value) for sync writes (triggers React re-renders)
 * - streamOffsetAtom for reconnection support
 * - Fiber tracking for cancellation
 *
 * @module geoint/atoms/operations
 */

import { Atom } from '@effect-atom/atom'
import { Effect, Stream, Match, Fiber, pipe, Option } from 'effect'
import { DurableStreamClient } from '../../durable-streams/service'
import {
  geointRegistry,
  resultsAtom,
  searchStatusAtom,
  streamingStateAtom,
  searchErrorAtom,
  searchQueryAtom,
} from './index'
import type { SearchEvent, SearchQuery, SearchResultItem } from '../schemas'

// =============================================================================
// RUNTIME ATOM (Effect integration point)
// =============================================================================

/**
 * Runtime atom for executing Effect operations.
 * Provides ctx for reading/writing atoms inside Effect.gen().
 */
export const runtimeAtom = Atom.runtime()

// =============================================================================
// STREAM STATE ATOMS
// =============================================================================

/**
 * Stream offset tracking for reconnection.
 * Maps queryId -> last seen offset.
 */
export const streamOffsetAtom = Atom.make<Record<string, string>>({})

/**
 * Active search fiber for cancellation.
 */
export const activeSearchFiberAtom = Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null)

/**
 * Sources that have completed in current search.
 */
export const completedSourcesAtom = Atom.make<readonly string[]>([])

// =============================================================================
// STREAMING SEARCH OPERATION
// =============================================================================

/**
 * Execute streaming search with DurableStream subscription.
 *
 * Flow:
 * 1. Cancel any existing search
 * 2. Reset state atoms
 * 3. Connect to DurableStream
 * 4. Process events reactively (atoms update, React re-renders)
 * 5. Track offset for reconnection
 */
export const streamingSearch = runtimeAtom.fn<{ query: SearchQuery; queryId: string }>()(
  ({ query, queryId }, ctx) =>
    Effect.gen(function* () {
      // Get DurableStreamClient (optional - graceful degradation)
      const dsClientOption = yield* Effect.serviceOption(DurableStreamClient)

      if (Option.isNone(dsClientOption)) {
        yield* Effect.logWarning('[StreamingSearch] DurableStreamClient not configured')
        ctx.set(searchErrorAtom, 'Streaming not available - DurableStreams not configured')
        ctx.set(searchStatusAtom, 'error')
        return
      }

      const dsClient = dsClientOption.value

      // Cancel any existing search
      const existingFiber = ctx(activeSearchFiberAtom)
      if (existingFiber) {
        yield* Effect.logInfo('[StreamingSearch] Cancelling existing search')
        yield* Fiber.interrupt(existingFiber)
      }

      // Reset state
      ctx.set(resultsAtom, [])
      ctx.set(completedSourcesAtom, [])
      ctx.set(searchStatusAtom, 'searching')
      ctx.set(searchQueryAtom, query)
      ctx.set(streamingStateAtom, {
        isStreaming: true,
        pendingCount: 0,
        lastUpdate: null,
      })
      ctx.set(searchErrorAtom, null)

      yield* Effect.logInfo(`[StreamingSearch] Starting search ${queryId}`)

      // Get last offset for reconnection
      const offsets = ctx(streamOffsetAtom)
      const lastOffset = offsets[queryId] ?? '0'

      // Connect to search stream
      const streamUrl = `/search/stream/${queryId}`
      const handle = yield* dsClient.getOrCreate<SearchEvent>({ url: streamUrl })

      yield* Effect.logInfo(`[StreamingSearch] Connected to ${streamUrl}, offset=${lastOffset}`)

      // Subscribe with offset
      const eventStream = yield* handle.subscribe({
        offset: lastOffset,
        live: 'sse',
      })

      // Process events reactively
      yield* eventStream.pipe(
        Stream.tap((batch) =>
          Effect.sync(() => {
            // Track offset for reconnection
            const currentOffsets = ctx(streamOffsetAtom)
            ctx.set(streamOffsetAtom, { ...currentOffsets, [queryId]: batch.offset })

            // Process each event
            for (const event of batch.items) {
              processSearchEvent(event, ctx)
            }
          })
        ),
        Stream.runDrain
      )

      yield* Effect.logInfo(`[StreamingSearch] Search ${queryId} stream ended`)
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`[StreamingSearch] Error: ${error}`)
          geointRegistry.set(searchStatusAtom, 'error')
          geointRegistry.set(searchErrorAtom, String(error))
          geointRegistry.set(streamingStateAtom, {
            isStreaming: false,
            pendingCount: 0,
            lastUpdate: Date.now(),
          })
        })
      )
    )
)

/**
 * Process a single search event (pure function for event handling).
 * Uses FnContext pattern where ctx(atom) reads and ctx.set(atom, value) writes.
 */
const processSearchEvent = (
  event: SearchEvent,
  ctx: {
    <A>(atom: Atom.Atom<A>): A
    set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void
  }
) => {
  pipe(
    Match.value(event),
    Match.tag('SearchStarted', (e) => {
      console.log('[SearchEvent] Started:', e.sources)
      ctx.set(streamingStateAtom, {
        isStreaming: true,
        pendingCount: e.sources.length,
        lastUpdate: Date.now(),
      })
    }),
    Match.tag('SearchPartialResults', (e) => {
      console.log(`[SearchEvent] PartialResults from ${e.source}:`, e.results.length, 'items')

      // Append results (doesn't replace)
      const current = ctx(resultsAtom)
      ctx.set(resultsAtom, [...current, ...e.results])

      // Track completed source
      if (e.isComplete) {
        const completed = ctx(completedSourcesAtom)
        ctx.set(completedSourcesAtom, [...completed, e.source])

        // Decrement pending count
        const state = ctx(streamingStateAtom)
        ctx.set(streamingStateAtom, {
          ...state,
          pendingCount: Math.max(0, state.pendingCount - 1),
          lastUpdate: Date.now(),
        })
      }
    }),
    Match.tag('SearchCompleted', (e) => {
      console.log('[SearchEvent] Completed:', e.totalResults, 'total results')
      ctx.set(searchStatusAtom, 'completed')
      ctx.set(streamingStateAtom, {
        isStreaming: false,
        pendingCount: 0,
        lastUpdate: Date.now(),
      })
    }),
    Match.orElse(() => {
      // Handle other event types (SearchSourceComplete, SearchSourceError, etc.)
      console.log('[SearchEvent] Unhandled event type:', (event as { _tag?: string })._tag)
    })
  )
}

// =============================================================================
// CANCEL SEARCH OPERATION
// =============================================================================

/**
 * Cancel active streaming search.
 */
export const cancelSearch = runtimeAtom.fn<void>()((_input, ctx) =>
  Effect.gen(function* () {
    const fiber = ctx(activeSearchFiberAtom)
    if (fiber) {
      yield* Effect.logInfo('[CancelSearch] Interrupting active search')
      yield* Fiber.interrupt(fiber)
      ctx.set(activeSearchFiberAtom, null)
    }
    ctx.set(searchStatusAtom, 'idle')
    ctx.set(streamingStateAtom, {
      isStreaming: false,
      pendingCount: 0,
      lastUpdate: Date.now(),
    })
  })
)

// =============================================================================
// RECONNECT SEARCH OPERATION
// =============================================================================

/**
 * Reconnect to an existing search stream (after disconnect).
 * Uses stored offset to resume from last seen event.
 */
export const reconnectSearch = runtimeAtom.fn<{ queryId: string }>()(
  ({ queryId }, ctx) =>
    Effect.gen(function* () {
      const dsClientOption = yield* Effect.serviceOption(DurableStreamClient)

      if (Option.isNone(dsClientOption)) {
        yield* Effect.fail(new Error('DurableStreamClient not configured'))
        return
      }

      const dsClient = dsClientOption.value
      const streamUrl = `/search/stream/${queryId}`

      // Check if stream exists
      const exists = yield* dsClient.exists(streamUrl)
      if (!exists) {
        yield* Effect.fail(new Error(`Search stream ${queryId} not found`))
        return
      }

      yield* Effect.logInfo(`[ReconnectSearch] Reconnecting to ${queryId}`)

      // Resume from last known offset
      ctx.set(searchStatusAtom, 'searching')
      ctx.set(streamingStateAtom, { isStreaming: true, pendingCount: 0, lastUpdate: null })

      const handle = yield* dsClient.connect<SearchEvent>({ url: streamUrl })
      const offsets = ctx(streamOffsetAtom)
      const lastOffset = offsets[queryId] ?? '0'

      yield* Effect.logInfo(`[ReconnectSearch] Resuming from offset ${lastOffset}`)

      const eventStream = yield* handle.subscribe({
        offset: lastOffset,
        live: 'sse',
      })

      yield* eventStream.pipe(
        Stream.tap((batch) =>
          Effect.sync(() => {
            const currentOffsets = ctx(streamOffsetAtom)
            ctx.set(streamOffsetAtom, { ...currentOffsets, [queryId]: batch.offset })

            for (const event of batch.items) {
              processSearchEvent(event, ctx)
            }
          })
        ),
        Stream.runDrain
      )
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`[ReconnectSearch] Error: ${error}`)
          geointRegistry.set(searchStatusAtom, 'error')
          geointRegistry.set(searchErrorAtom, String(error))
        })
      )
    )
)

// =============================================================================
// MOCK STREAMING SEARCH (For testing without DurableStreams)
// =============================================================================

/**
 * Simulate streaming search for testing the atom reactivity.
 * Useful when DurableStreams server is not running.
 */
export const mockStreamingSearch = runtimeAtom.fn<{ query: SearchQuery }>()(
  ({ query }, ctx) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('[MockStreamingSearch] Starting simulated search')

      // Reset state
      ctx.set(resultsAtom, [])
      ctx.set(completedSourcesAtom, [])
      ctx.set(searchStatusAtom, 'searching')
      ctx.set(searchQueryAtom, query)
      ctx.set(searchErrorAtom, null)

      const sources = query.sources.length > 0
        ? query.sources
        : ['track', 'osm', 'opensky', 'feature'] as const

      ctx.set(streamingStateAtom, {
        isStreaming: true,
        pendingCount: sources.length,
        lastUpdate: Date.now(),
      })

      // Simulate SearchStarted
      yield* Effect.sleep('100 millis')
      console.log('[MockSearch] Started with sources:', sources)

      // Simulate partial results from each source with delays
      for (const source of sources) {
        yield* Effect.sleep('500 millis')

        // Generate mock results
        const mockResults = generateMockResults(source, 5)

        // Append to results
        const current = ctx(resultsAtom)
        ctx.set(resultsAtom, [...current, ...mockResults])

        // Track completed source
        const completed = ctx(completedSourcesAtom)
        ctx.set(completedSourcesAtom, [...completed, source])

        // Update streaming state
        const state = ctx(streamingStateAtom)
        ctx.set(streamingStateAtom, {
          ...state,
          pendingCount: Math.max(0, state.pendingCount - 1),
          lastUpdate: Date.now(),
        })

        console.log(`[MockSearch] ${source}: ${mockResults.length} results`)
      }

      // Simulate completion
      yield* Effect.sleep('200 millis')
      const finalResults = ctx(resultsAtom)
      console.log('[MockSearch] Completed with', finalResults.length, 'total results')

      ctx.set(searchStatusAtom, 'completed')
      ctx.set(streamingStateAtom, {
        isStreaming: false,
        pendingCount: 0,
        lastUpdate: Date.now(),
      })
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error('[MockStreamingSearch] Error:', error)
          geointRegistry.set(searchStatusAtom, 'error')
          geointRegistry.set(searchErrorAtom, String(error))
        })
      )
    )
)

/**
 * Generate mock search results for testing.
 */
const generateMockResults = (source: string, count: number): SearchResultItem[] => {
  const results: SearchResultItem[] = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const id = `mock-${source}-${Date.now()}-${i}`
    const lon = -122.4 + (Math.random() - 0.5) * 0.1
    const lat = 37.78 + (Math.random() - 0.5) * 0.1

    switch (source) {
      case 'track':
        results.push({
          _tag: 'SearchResultTrack',
          id: id as any,
          source: 'track',
          score: Math.random(),
          retrievedAt: now,
          trackId: `TRK-${i}` as any,
          position: [lon, lat, 0],
          heading: Math.random() * 360,
          speed: Math.random() * 100,
          classification: 'friendly',
          objectType: 'vehicle',
          label: `Track ${i}`,
        } as any)
        break

      case 'osm':
        results.push({
          _tag: 'SearchResultPoi',
          id: id as any,
          source: 'osm',
          score: Math.random(),
          retrievedAt: now,
          poiId: `POI-${i}` as any,
          position: [lon, lat],
          name: `Coffee Shop ${i}`,
          category: 'amenity',
          tags: { amenity: 'cafe' },
        } as any)
        break

      case 'opensky':
        results.push({
          _tag: 'SearchResultFlight',
          id: id as any,
          source: 'opensky',
          score: Math.random(),
          retrievedAt: now,
          icao24: `ABC${i}${i}${i}` as any,
          callsign: `UAL${1000 + i}`,
          position: [lon, lat, 10000 + Math.random() * 30000],
          velocity: 200 + Math.random() * 300,
          heading: Math.random() * 360,
          verticalRate: (Math.random() - 0.5) * 20,
          onGround: false,
          category: 'large',
          originCountry: 'United States',
          lastContact: now,
        } as any)
        break

      case 'feature':
        results.push({
          _tag: 'SearchResultFeature',
          id: id as any,
          source: 'feature',
          score: Math.random(),
          retrievedAt: now,
          featureId: `FEAT-${i}` as any,
          position: [lon, lat],
          geometryType: 'Point',
          properties: { type: 'landmark' },
          label: `Feature ${i}`,
        } as any)
        break
    }
  }

  return results
}
