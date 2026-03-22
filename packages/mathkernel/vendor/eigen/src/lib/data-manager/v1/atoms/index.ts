/**
 * TMNL DataManager v1 - Atoms (Materialized Views)
 *
 * These atoms represent the **materialized views** that DataManager publishes.
 * Components subscribe to these atoms; DataManager updates them during operations.
 *
 * Pattern:
 * - Atoms declared at module level (singleton, writable)
 * - Operation atoms use FnContext.set() to publish updates
 * - Components call useAtomValue() to subscribe
 * - Multiple components share the same view (same atom)
 *
 * Key insight: Inside runtimeAtom.fn((arg, get) => ...), the `get` parameter
 * is a FnContext with a `set` method: get.set(atom, value)
 *
 * @experimental v1 API may change. v2 when stable.
 */

import { Atom } from '@effect-atom/atom-react';
import * as Layer from 'effect/Layer';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

import { SearchKernel } from '../kernels';
import type {
  SearchResult,
  SearchQuery,
  StreamStatus,
  StreamStats,
  DriverState,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Materialized View Atoms (Module-Level Singletons)
// Must be Writable for FnContext.set() to work
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search Results Atom
 *
 * Progressive search results from active stream.
 * Updated by searchOps.search as stream emits chunks.
 */
export const resultsAtom = Atom.make<readonly SearchResult<unknown>[]>([]);

/**
 * Stream Status Atom
 *
 * Current status: idle | streaming | complete | cancelled | error
 */
// PATTERN:PRIMITIVE_ATOM
export const statusAtom = Atom.make<StreamStatus>('idle');

/**
 * Stream Stats Atom
 *
 * Metrics: chunks processed, items received, duration in ms
 */
export const statsAtom = Atom.make<StreamStats>({ chunks: 0, items: 0, ms: 0 });

/**
 * Drivers Atom
 *
 * Current driver state: flex/linear instances and active selection
 */
export const driversAtom = Atom.make<DriverState<unknown>>({
  flex: null,
  linear: null,
  active: 'flex',
});

/**
 * Is Indexing Atom
 *
 * True when index operation is in progress
 */
export const isIndexingAtom = Atom.make<boolean>(false);

/**
 * Current Query Atom
 *
 * The active search query string
 */
export const queryAtom = Atom.make<string>('');

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atoms (Computed from Materialized Views)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is Searching Atom
 *
 * Derived from status: true when streaming
 */
export const isSearchingAtom = Atom.make((get) => {
  const status = get(statusAtom);
  return status === 'streaming';
});

/**
 * Has Results Atom
 *
 * Derived from results: true when results exist
 */
export const hasResultsAtom = Atom.make((get) => {
  const results = get(resultsAtom);
  return results.length > 0;
});

/**
 * Result Count Atom
 *
 * Derived from results: current result count
 */
export const resultCountAtom = Atom.make((get) => {
  const results = get(resultsAtom);
  return results.length;
});

/**
 * Throughput Atom
 *
 * Derived from stats: items per second
 */
export const throughputAtom = Atom.make((get) => {
  const stats = get(statsAtom);
  if (stats.ms > 0) {
    return (stats.items / stats.ms) * 1000; // items per second
  }
  return 0;
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Atom (For Effect Operations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DataManager Runtime Atom
 *
 * Provides Effect runtime for operations that need SearchKernel.
 * Used by operation atoms (searchOps, indexOps) to execute Effects.
 */
export const dataManagerRuntimeAtom = Atom.runtime(SearchKernel.Default);

// ─────────────────────────────────────────────────────────────────────────────
// Operation Atoms (Mutations via Effect)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search Operations
 *
 * Mutation atoms for triggering search operations.
 * These update the materialized view atoms via FnContext.set()
 */
export const searchOps = {
  /**
   * Execute search and update materialized views
   *
   * Flow:
   * 1. Reset atoms (results=[], status=streaming)
   * 2. Execute search via SearchKernel
   * 3. Update resultsAtom with collected results
   * 4. Set status=complete when done
   *
   * Key: Use `ctx.set(atom, value)` to update materialized views
   */
  search: dataManagerRuntimeAtom.fn<SearchQuery>()((query, ctx) =>
    Effect.gen(function* () {
      console.log('[DataManager.search] Starting search', {
        query: query.query,
        limit: query.limit,
      });

      // Reset materialized views via FnContext.set()
      ctx.set(resultsAtom, []);
      ctx.set(statusAtom, 'streaming');
      ctx.set(statsAtom, { chunks: 0, items: 0, ms: 0 });
      ctx.set(queryAtom, query.query);

      const startTime = Date.now();
      const kernel = yield* SearchKernel;
      console.log('[DataManager.search] Got kernel instance');

      // Get driver instance for searching
      const driver = yield* kernel.getDriverInstance();
      console.log('[DataManager.search] Driver check:', {
        hasDriver: driver !== null,
        driverType: driver?.type,
        itemCount: driver?.itemCount,
      });

      if (!driver) {
        console.error(
          '[DataManager.search] No driver available - was data indexed?'
        );
        ctx.set(statusAtom, 'error');
        return yield* Effect.fail(
          new Error('No search driver available. Index data first.')
        );
      }

      // Collect all results from stream
      const allResults: SearchResult<unknown>[] = [];

      yield* Stream.runForEach(driver.search(query), (result) =>
        Effect.sync(() => {
          allResults.push(result as SearchResult<unknown>);

          // Progressive update every 50 results
          if (allResults.length % 50 === 0) {
            console.log(
              '[DataManager.search] Progressive update:',
              allResults.length,
              'results'
            );
            ctx.set(resultsAtom, [...allResults]);
            ctx.set(statsAtom, {
              chunks: Math.ceil(allResults.length / 50),
              items: allResults.length,
              ms: Date.now() - startTime,
            });
          }
        })
      );

      // Final update
      const finalMs = Date.now() - startTime;
      console.log('[DataManager.search] Complete:', {
        resultCount: allResults.length,
        durationMs: finalMs,
      });

      ctx.set(resultsAtom, allResults);
      ctx.set(statusAtom, 'complete');
      ctx.set(statsAtom, {
        chunks: Math.ceil(allResults.length / 50),
        items: allResults.length,
        ms: finalMs,
      });

      return allResults;
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error('[DataManager.search] Error:', error);
          ctx.set(statusAtom, 'error');
        })
      )
    )
  ),

  /**
   * Set active driver (flex or linear)
   */
  setDriver: dataManagerRuntimeAtom.fn<'flex' | 'linear'>()((driver, ctx) =>
    Effect.gen(function* () {
      const kernel = yield* SearchKernel;
      yield* kernel.setActiveDriver(driver);
      ctx.set(driversAtom, { flex: null, linear: null, active: driver });
    })
  ),
};

/**
 * Index Operations
 *
 * Mutation atoms for indexing operations.
 */
export const indexOps = {
  /**
   * Index items into search drivers
   *
   * Updates isIndexingAtom during operation.
   * Returns: { indexed: boolean, itemCount: number }
   */
  index: dataManagerRuntimeAtom.fn<{
    items: readonly unknown[];
    fields: readonly string[];
  }>()(({ items, fields }, ctx) =>
    Effect.gen(function* () {
      console.log('[DataManager.index] Starting index operation', {
        itemCount: items.length,
        fields,
      });
      ctx.set(isIndexingAtom, true);

      const kernel = yield* SearchKernel;
      console.log('[DataManager.index] Got kernel instance');

      yield* kernel.index(items, {
        fields: fields as string[],
        getId: (item: unknown) => String((item as { id: unknown }).id),
      });

      console.log('[DataManager.index] Index complete, verifying driver...');

      // Verify indexing worked by checking driver instance
      const driver = yield* kernel.getDriverInstance();
      const success = driver !== null;

      console.log('[DataManager.index] Driver check:', {
        success,
        driverType: driver?.type,
        itemCount: driver?.itemCount,
      });

      ctx.set(isIndexingAtom, false);

      return { indexed: success, itemCount: driver?.itemCount ?? 0 };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error('[DataManager.index] Error:', error);
          ctx.set(isIndexingAtom, false);
        })
      )
    )
  ),
};
