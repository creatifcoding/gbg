/**
 * useMockStream Hook
 *
 * React hook for consuming Effect-based mock data streams.
 * Handles fiber lifecycle and cleanup automatically.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { Effect, Stream, Fiber, Runtime, Exit } from 'effect'
import {
  createMockDataStream,
  type StreamEvent,
  type StreamConfig,
  type MockRow,
  type RowUpdate,
  DEFAULT_STREAM_CONFIG,
} from '../mocking'

// =============================================================================
// TYPES
// =============================================================================

export interface UseMockStreamOptions extends Partial<StreamConfig> {
  /** Start streaming immediately on mount */
  autoStart?: boolean
}

export interface UseMockStreamResult {
  /** Current row data */
  rows: readonly MockRow[]
  /** Updates from last tick (for flash tracking) */
  lastUpdates: readonly RowUpdate[]
  /** Current tick number */
  tick: number
  /** Whether stream is running */
  isStreaming: boolean
  /** Start the stream */
  start: () => void
  /** Stop the stream */
  stop: () => void
  /** Toggle streaming state */
  toggle: () => void
  /** Update stream config (restarts stream) */
  setConfig: (config: Partial<StreamConfig>) => void
  /** Current config */
  config: StreamConfig
}

// =============================================================================
// HOOK
// =============================================================================

export function useMockStream(
  options: UseMockStreamOptions = {}
): UseMockStreamResult {
  const { autoStart = true, ...configOverrides } = options

  const [config, setConfigState] = useState<StreamConfig>({
    ...DEFAULT_STREAM_CONFIG,
    ...configOverrides,
  })

  const [rows, setRows] = useState<readonly MockRow[]>([])
  const [lastUpdates, setLastUpdates] = useState<readonly RowUpdate[]>([])
  const [tick, setTick] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)

  const fiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null)
  const runtimeRef = useRef(Runtime.defaultRuntime)

  const stopStream = useCallback(() => {
    if (fiberRef.current) {
      Effect.runFork(Fiber.interrupt(fiberRef.current))
      fiberRef.current = null
      setIsStreaming(false)
    }
  }, [])

  const startStream = useCallback(() => {
    // Stop existing stream first
    stopStream()

    const stream = createMockDataStream(config)

    const program = Stream.runForEach(stream, (event: StreamEvent) =>
      Effect.sync(() => {
        setRows(event.rows)
        setLastUpdates(event.updates)
        setTick(event.tick)
      })
    )

    const fiber = Runtime.runFork(runtimeRef.current)(program)
    fiberRef.current = fiber
    setIsStreaming(true)
  }, [config, stopStream])

  const toggle = useCallback(() => {
    if (isStreaming) {
      stopStream()
    } else {
      startStream()
    }
  }, [isStreaming, startStream, stopStream])

  const setConfig = useCallback((newConfig: Partial<StreamConfig>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }))
  }, [])

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart) {
      startStream()
    }

    return () => {
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, [])

  // Restart stream when config changes (if currently streaming)
  useEffect(() => {
    if (isStreaming) {
      startStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config change triggers restart
  }, [config])

  return {
    rows,
    lastUpdates,
    tick,
    isStreaming,
    start: startStream,
    stop: stopStream,
    toggle,
    setConfig,
    config,
  }
}
