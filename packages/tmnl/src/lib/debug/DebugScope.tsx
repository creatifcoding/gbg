/**
 * DebugScope — Component Instrumentation Context
 *
 * Provides per-component debug context with:
 * - Conditional activation via `debug` prop
 * - Lifecycle event logging (mount, unmount, update)
 * - Dependency tracking with diff detection
 * - Rich metadata rendering via Effect Console
 *
 * Usage patterns:
 *
 * 1. **Provider pattern** — Wrap component subtree
 *    ```tsx
 *    <DebugScopeProvider debug={true} name="MyComponent">
 *      <MyComponent />
 *    </DebugScopeProvider>
 *    ```
 *
 * 2. **Content pattern** — Render-nothing instrumentation
 *    ```tsx
 *    function MyComponent({ debug }) {
 *      return (
 *        <>
 *          <DebugScope debug={debug} name="MyComponent" watch={{ count, status }} />
 *          {/* actual content *\/}
 *        </>
 *      )
 *    }
 *    ```
 *
 * 3. **Hook pattern** — Imperative logging
 *    ```tsx
 *    function MyComponent({ debug }) {
 *      const scope = useDebugScope({ debug, name: "MyComponent" })
 *      scope.log("Custom event", { data })
 *      // ...
 *    }
 *    ```
 *
 * @module
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useDebugValue,
  useMemo,
  type ReactNode,
} from "react"
import { Effect, Console } from "effect"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DebugScopeConfig {
  /** Component/scope name for log prefixing */
  name: string
  /** Enable debug mode */
  debug?: boolean
  /** Log mount/unmount events */
  logLifecycle?: boolean
  /** Log dependency changes */
  logDeps?: boolean
  /** Custom metadata to include in logs */
  metadata?: Record<string, unknown>
}

export interface DebugScopeProps extends DebugScopeConfig {
  /** Values to watch for changes (like useEffect deps) */
  watch?: Record<string, unknown>
  /** Children (for provider pattern) */
  children?: ReactNode
}

export interface UseDebugScopeOptions extends DebugScopeConfig {
  /** Dependencies to watch */
  deps?: unknown[]
  /** Labels for dependencies (for better logging) */
  depLabels?: string[]
}

export interface DebugScopeContextValue {
  /** Whether debug is enabled */
  enabled: boolean
  /** Scope name */
  name: string
  /** Log a message (no-op if debug disabled) */
  log: (message: string, data?: Record<string, unknown>) => void
  /** Log an error (no-op if debug disabled) */
  error: (message: string, data?: Record<string, unknown>) => void
  /** Log a warning (no-op if debug disabled) */
  warn: (message: string, data?: Record<string, unknown>) => void
  /** Create a child scope */
  child: (name: string) => DebugScopeContextValue
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const DebugScopeContext = createContext<DebugScopeContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const formatPrefix = (name: string) => `[${name}]`

const createLogger = (name: string, enabled: boolean, metadata?: Record<string, unknown>) => {
  const prefix = formatPrefix(name)

  const log = (message: string, data?: Record<string, unknown>) => {
    if (!enabled) return
    const payload = { ...metadata, ...data }
    if (Object.keys(payload).length > 0) {
      Effect.runSync(Console.log(`${prefix} ${message}`, payload))
    } else {
      Effect.runSync(Console.log(`${prefix} ${message}`))
    }
  }

  const error = (message: string, data?: Record<string, unknown>) => {
    if (!enabled) return
    Effect.runSync(Console.error(`${prefix} ${message}`, { ...metadata, ...data }))
  }

  const warn = (message: string, data?: Record<string, unknown>) => {
    if (!enabled) return
    Effect.runSync(Console.warn(`${prefix} ${message}`, { ...metadata, ...data }))
  }

  return { log, error, warn }
}

const createScopeValue = (
  name: string,
  enabled: boolean,
  metadata?: Record<string, unknown>
): DebugScopeContextValue => {
  const logger = createLogger(name, enabled, metadata)

  return {
    enabled,
    name,
    log: logger.log,
    error: logger.error,
    warn: logger.warn,
    child: (childName: string) =>
      createScopeValue(`${name}.${childName}`, enabled, metadata),
  }
}

/**
 * Detect which dependencies changed between renders
 */
const diffDeps = (
  prev: unknown[] | undefined,
  next: unknown[],
  labels?: string[]
): Array<{ index: number; label: string; from: unknown; to: unknown }> => {
  if (!prev) return []

  const changes: Array<{ index: number; label: string; from: unknown; to: unknown }> = []

  for (let i = 0; i < Math.max(prev.length, next.length); i++) {
    if (!Object.is(prev[i], next[i])) {
      changes.push({
        index: i,
        label: labels?.[i] ?? `dep[${i}]`,
        from: prev[i],
        to: next[i],
      })
    }
  }

  return changes
}

/**
 * Detect which watched values changed
 */
const diffWatch = (
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>
): Array<{ key: string; from: unknown; to: unknown }> => {
  if (!prev) return []

  const changes: Array<{ key: string; from: unknown; to: unknown }> = []
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])

  for (const key of allKeys) {
    if (!Object.is(prev[key], next[key])) {
      changes.push({ key, from: prev[key], to: next[key] })
    }
  }

  return changes
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useDebugScope — Imperative debug logging hook
 *
 * Creates a debug scope with lifecycle logging and dependency tracking.
 * All logging is no-op when debug is disabled.
 *
 * @example
 * ```tsx
 * function MyComponent({ debug, count, status }) {
 *   const scope = useDebugScope({
 *     debug,
 *     name: "MyComponent",
 *     deps: [count, status],
 *     depLabels: ["count", "status"],
 *   })
 *
 *   scope.log("Rendered", { count, status })
 *
 *   const handleClick = () => {
 *     scope.log("Button clicked")
 *   }
 * }
 * ```
 */
export function useDebugScope(options: UseDebugScopeOptions): DebugScopeContextValue {
  const {
    name,
    debug = false,
    logLifecycle = true,
    logDeps = true,
    metadata,
    deps = [],
    depLabels,
  } = options

  const prevDepsRef = useRef<unknown[] | undefined>(undefined)
  const mountTimeRef = useRef<number>(0)

  const scope = useMemo(
    () => createScopeValue(name, debug, metadata),
    [name, debug, metadata]
  )

  // Expose to React DevTools
  useDebugValue(debug ? `${name} (debug)` : name)

  // Lifecycle logging
  useEffect(() => {
    if (!debug || !logLifecycle) return

    mountTimeRef.current = performance.now()
    scope.log("MOUNT", metadata)

    return () => {
      const duration = performance.now() - mountTimeRef.current
      scope.log("UNMOUNT", { duration: `${duration.toFixed(2)}ms` })
    }
  }, [debug, logLifecycle, name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dependency change detection
  useEffect(() => {
    if (!debug || !logDeps || deps.length === 0) {
      prevDepsRef.current = deps
      return
    }

    const changes = diffDeps(prevDepsRef.current, deps, depLabels)

    if (changes.length > 0) {
      scope.log("DEPS CHANGED", {
        changes: changes.map((c) => ({
          [c.label]: { from: c.from, to: c.to },
        })),
      })
    }

    prevDepsRef.current = deps
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return scope
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DebugScope — Render-nothing instrumentation component
 *
 * Logs lifecycle and watched value changes without rendering anything.
 * Use inside a component to instrument it.
 *
 * @example
 * ```tsx
 * function Screensaver({ debug, isActive, timeRemaining }) {
 *   return (
 *     <>
 *       <DebugScope
 *         debug={debug}
 *         name="Screensaver"
 *         watch={{ isActive, timeRemaining }}
 *       />
 *       {isActive && <AsciiScene />}
 *     </>
 *   )
 * }
 * ```
 */
export function DebugScope({
  name,
  debug = false,
  logLifecycle = true,
  logDeps = true,
  metadata,
  watch,
}: DebugScopeProps): null {
  const prevWatchRef = useRef<Record<string, unknown> | undefined>(undefined)
  const mountTimeRef = useRef<number>(0)

  const scope = useMemo(
    () => createScopeValue(name, debug, metadata),
    [name, debug, metadata]
  )

  // Expose to React DevTools
  useDebugValue(debug ? `${name} (debug)` : name)

  // Lifecycle logging
  useEffect(() => {
    if (!debug || !logLifecycle) return

    mountTimeRef.current = performance.now()
    scope.log("MOUNT", { ...metadata, watch })

    return () => {
      const duration = performance.now() - mountTimeRef.current
      scope.log("UNMOUNT", { duration: `${duration.toFixed(2)}ms` })
    }
  }, [debug, logLifecycle, name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Watch value change detection
  useEffect(() => {
    if (!debug || !logDeps || !watch) {
      prevWatchRef.current = watch
      return
    }

    const changes = diffWatch(prevWatchRef.current, watch)

    if (changes.length > 0) {
      scope.log("WATCH CHANGED", {
        changes: Object.fromEntries(
          changes.map((c) => [c.key, { from: c.from, to: c.to }])
        ),
      })
    }

    prevWatchRef.current = watch
  }, [debug, logDeps, watch ? JSON.stringify(watch) : null]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/**
 * DebugScopeProvider — Context provider for debug scope
 *
 * Wraps a component subtree with debug context.
 * Child components can use useDebugScopeContext() to access the scope.
 *
 * @example
 * ```tsx
 * <DebugScopeProvider debug={true} name="ScreensaverSystem">
 *   <ScreensaverOverlay />
 *   <IdleDetector />
 * </DebugScopeProvider>
 * ```
 */
export function DebugScopeProvider({
  name,
  debug = false,
  logLifecycle = true,
  metadata,
  children,
}: DebugScopeProps): ReactNode {
  const mountTimeRef = useRef<number>(0)

  const scope = useMemo(
    () => createScopeValue(name, debug, metadata),
    [name, debug, metadata]
  )

  // Expose to React DevTools
  useDebugValue(debug ? `${name} (debug)` : name)

  // Lifecycle logging
  useEffect(() => {
    if (!debug || !logLifecycle) return

    mountTimeRef.current = performance.now()
    scope.log("PROVIDER MOUNT", metadata)

    return () => {
      const duration = performance.now() - mountTimeRef.current
      scope.log("PROVIDER UNMOUNT", { duration: `${duration.toFixed(2)}ms` })
    }
  }, [debug, logLifecycle, name]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DebugScopeContext.Provider value={scope}>
      {children}
    </DebugScopeContext.Provider>
  )
}

/**
 * useDebugScopeContext — Access parent DebugScopeProvider
 *
 * Returns the debug scope from the nearest DebugScopeProvider.
 * Returns a no-op scope if no provider is found.
 */
export function useDebugScopeContext(): DebugScopeContextValue {
  const context = useContext(DebugScopeContext)

  if (!context) {
    // Return a no-op scope if no provider
    return {
      enabled: false,
      name: "orphan",
      log: () => {},
      error: () => {},
      warn: () => {},
      child: (name) => createScopeValue(name, false),
    }
  }

  return context
}
