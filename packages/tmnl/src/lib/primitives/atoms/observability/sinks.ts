/**
 * Event Sinks - Pre-built sinks for AtomObservabilityEvents
 *
 * Provides ready-to-use sinks for routing observability events to:
 * - Testbed Logger (structured, queryable, persists in session)
 * - Console (for development)
 * - DevTools (React DevTools integration)
 *
 * @module primitives/atoms/observability/sinks
 */

import { Match } from 'effect'
import type { AtomObservabilityEvent } from './schemas'
import { emitToDevTools } from './devtools'
import {
  appendLog,
  type LogLevel,
} from '@/components/testbed/atoms/testbed-log'

// =============================================================================
// Testbed Logger Sink
// =============================================================================

/**
 * Route observability events to Testbed Logger atoms
 *
 * This is the recommended default sink for debugging - events appear in the
 * testbed log panel with filtering, search, and persistence.
 *
 * @example
 * ```typescript
 * const traced = createTracedAtomGroup({
 *   groupId: 'map:123',
 *   atoms: mapAtoms,
 *   registry: mapRegistry,
 *   onEvent: testbedLoggerSink,
 * })
 * ```
 */
export function testbedLoggerSink(event: AtomObservabilityEvent): void {
  const source = `atom:${event.groupId}`

  Match.value(event).pipe(
    Match.tag('AtomRead', (e) => {
      appendLog('debug', source, `read ${e.atomKey}`, {
        value: e.value,
        timestamp: e.timestamp,
      })
    }),

    Match.tag('AtomWrite', (e) => {
      appendLog('info', source, `write ${e.atomKey}`, {
        prevValue: e.prevValue,
        nextValue: e.nextValue,
        source: e.source,
        timestamp: e.timestamp,
      })
    }),

    Match.tag('AtomSubscribe', (e) => {
      appendLog('debug', source, `subscribe ${e.atomKey}`, {
        subscriberId: e.subscriberId,
        timestamp: e.timestamp,
      })
    }),

    Match.tag('AtomUnsubscribe', (e) => {
      appendLog('debug', source, `unsubscribe ${e.atomKey}`, {
        subscriberId: e.subscriberId,
        timestamp: e.timestamp,
      })
    }),

    Match.tag('AtomGroupCreated', (e) => {
      appendLog('success', source, `group created`, {
        atomKeys: e.atomKeys,
        timestamp: e.timestamp,
      })
    }),

    Match.tag('AtomGroupDisposed', (e) => {
      appendLog('warn', source, `group disposed`, {
        timestamp: e.timestamp,
      })
    }),

    Match.exhaustive
  )
}

// =============================================================================
// Console Sink
// =============================================================================

/**
 * Route observability events to console with structured formatting
 *
 * Useful for quick debugging without testbed UI. Uses console.group
 * for AtomWrite events to show prev/next values clearly.
 *
 * @example
 * ```typescript
 * const traced = createTracedAtomGroup({
 *   groupId: 'map:123',
 *   atoms: mapAtoms,
 *   registry: mapRegistry,
 *   onEvent: consoleSink,
 * })
 * ```
 */
export function consoleSink(event: AtomObservabilityEvent): void {
  const prefix = `[Atom:${event.groupId}]`
  const timestamp = new Date(event.timestamp).toISOString().slice(11, 23)

  Match.value(event).pipe(
    Match.tag('AtomRead', (e) => {
      console.log(`${prefix} [${timestamp}] READ ${e.atomKey}`, e.value)
    }),

    Match.tag('AtomWrite', (e) => {
      console.group(`${prefix} [${timestamp}] WRITE ${e.atomKey}${e.source ? ` (${e.source})` : ''}`)
      console.log('prev:', e.prevValue)
      console.log('next:', e.nextValue)
      console.groupEnd()
    }),

    Match.tag('AtomSubscribe', (e) => {
      console.log(`${prefix} [${timestamp}] SUBSCRIBE ${e.atomKey}`, e.subscriberId)
    }),

    Match.tag('AtomUnsubscribe', (e) => {
      console.log(`${prefix} [${timestamp}] UNSUBSCRIBE ${e.atomKey}`, e.subscriberId)
    }),

    Match.tag('AtomGroupCreated', (e) => {
      console.log(`${prefix} [${timestamp}] GROUP CREATED`, e.atomKeys)
    }),

    Match.tag('AtomGroupDisposed', (e) => {
      console.log(`${prefix} [${timestamp}] GROUP DISPOSED`)
    }),

    Match.exhaustive
  )
}

// =============================================================================
// Composite Sink
// =============================================================================

/**
 * Create a sink that routes events to multiple sinks
 *
 * @example
 * ```typescript
 * const traced = createTracedAtomGroup({
 *   groupId: 'map:123',
 *   atoms: mapAtoms,
 *   registry: mapRegistry,
 *   onEvent: compositeSink([testbedLoggerSink, consoleSink]),
 * })
 * ```
 */
export function compositeSink(
  sinks: Array<(event: AtomObservabilityEvent) => void>
): (event: AtomObservabilityEvent) => void {
  return (event) => {
    for (const sink of sinks) {
      try {
        sink(event)
      } catch (err) {
        console.error('[compositeSink] Sink error:', err)
      }
    }
  }
}

// =============================================================================
// DevTools + Testbed Sink (Recommended Default)
// =============================================================================

/**
 * Combined sink: Testbed Logger + DevTools
 *
 * This is the recommended default for debugging - events appear in both
 * the testbed log panel AND React DevTools timeline.
 *
 * @example
 * ```typescript
 * const traced = createTracedAtomGroup({
 *   groupId: 'map:123',
 *   atoms: mapAtoms,
 *   registry: mapRegistry,
 *   onEvent: defaultDebugSink,
 * })
 * ```
 */
export function defaultDebugSink(event: AtomObservabilityEvent): void {
  testbedLoggerSink(event)
  emitToDevTools(event)
}

// =============================================================================
// Filtered Sink
// =============================================================================

/**
 * Create a sink that filters events by tag
 *
 * @example
 * ```typescript
 * // Only log writes
 * const traced = createTracedAtomGroup({
 *   groupId: 'map:123',
 *   atoms: mapAtoms,
 *   registry: mapRegistry,
 *   onEvent: filteredSink(testbedLoggerSink, ['AtomWrite']),
 * })
 * ```
 */
export function filteredSink(
  sink: (event: AtomObservabilityEvent) => void,
  allowedTags: AtomObservabilityEvent['_tag'][]
): (event: AtomObservabilityEvent) => void {
  const tagSet = new Set(allowedTags)
  return (event) => {
    if (tagSet.has(event._tag)) {
      sink(event)
    }
  }
}
