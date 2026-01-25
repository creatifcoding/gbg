/**
 * Atom Observability - Effect-native tracing and logging for atom groups
 *
 * Provides structured observability for debugging atom state flow:
 * - Typed event schemas (AtomRead, AtomWrite, AtomSubscribe, etc.)
 * - Traced atom group factory with per-group toggle
 * - Pre-built sinks (Testbed Logger, Console, DevTools)
 *
 * @module primitives/atoms/observability
 *
 * @example
 * ```typescript
 * import {
 *   createTracedAtomGroup,
 *   testbedLoggerSink,
 *   initAtomDevTools,
 * } from '@/lib/primitives/atoms/observability'
 *
 * // Initialize DevTools hook at app startup (main.tsx)
 * if (import.meta.env.DEV) {
 *   initAtomDevTools()
 * }
 *
 * // Create traced atom group
 * const traced = createTracedAtomGroup({
 *   groupId: `map:${instanceId}`,
 *   atoms: createMapInstanceAtoms(instanceId),
 *   registry: mapRegistry,
 *   onEvent: testbedLoggerSink,
 * })
 *
 * // Use traced operations
 * traced.set('dimensionsAtom', { width: 800, height: 600 }, 'ResizeObserver')
 * const dims = traced.get('dimensionsAtom')
 *
 * // Original atoms still work with useAtomValue
 * const value = useAtomValue(traced.atoms.dimensionsAtom)
 * ```
 */

// Schemas
export {
  AtomRead,
  AtomWrite,
  AtomSubscribe,
  AtomUnsubscribe,
  AtomGroupCreated,
  AtomGroupDisposed,
  AtomObservabilityEvent,
  type AtomObservabilityEventTag,
} from './schemas'

// Factory
export {
  createTracedAtomGroup,
  logAtomOp,
  type TracedAtomGroup,
  type TracedAtomGroupConfig,
} from './traced-group'

// DevTools
export {
  initAtomDevTools,
  getAtomDevTools,
  emitToDevTools,
  markDevToolsEvent,
  measureDevToolsEvent,
  type AtomDevToolsHook,
} from './devtools'

// Sinks
export {
  testbedLoggerSink,
  consoleSink,
  compositeSink,
  defaultDebugSink,
  filteredSink,
} from './sinks'
