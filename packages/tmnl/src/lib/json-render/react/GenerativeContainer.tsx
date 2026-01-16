/**
 * @fileoverview GenerativeContainer - Recursive AI-generated UI
 *
 * Enables nested AI generation within the json-render system.
 * Each container can spawn its own UITree via streaming.
 *
 * Architecture:
 * - Uses Atom.family for per-container state isolation
 * - Depth-limited via React Context
 * - Caches results per session (future: Effect Cache)
 *
 * @example
 * ```tsx
 * // In a json-render tree:
 * { type: "GenerativeContainer", props: { prompt: "Generate user stats" } }
 *
 * // Renders nested UI from AI response
 * ```
 */

"use client"

import { type ReactNode, useEffect, useMemo, useCallback, useRef, useId, useContext } from "react"
import { Effect, Option } from "effect"
import { useAtomValue, RegistryContext } from "@effect-atom/atom-react"

import { type ComponentRegistry } from "./index"
import { Renderer } from "./renderer"
import { GenerativeDepthProvider, useGenerativeDepth } from "./generative"
import { getContainerAtoms } from "./atoms"
import type { Action } from "../core/schemas"

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_API = "http://localhost:7682/ui-generate"
const DEFAULT_MAX_DEPTH = 3

// =============================================================================
// Effect Logging Helpers (fire-and-forget for React context)
// =============================================================================

const log = (message: string) => Effect.runFork(Effect.log(message))
const logDebug = (message: string) => Effect.runFork(Effect.logDebug(message))
const logError = (message: string) => Effect.runFork(Effect.logError(message))

// =============================================================================
// Atom Family-based Streaming Hook (per-container isolation)
// =============================================================================

/**
 * Container UI streaming hook using Atom.family
 *
 * Uses atom families keyed by containerId for state isolation.
 * Each GenerativeContainer gets its own atoms, preventing nested
 * containers from overwriting parent state.
 *
 * Pattern: Atom.family + registry.set() + useAtomValue()
 */
function useContainerUIStream(containerId: string, api: string) {
  const registry = useContext(RegistryContext)
  const atoms = useMemo(() => getContainerAtoms(containerId), [containerId])
  const abortControllerRef = useRef<AbortController | null>(null)

  // Subscribe to atom values
  const tree = useAtomValue(atoms.tree)
  const isStreaming = useAtomValue(atoms.isStreaming)
  const error = useAtomValue(atoms.error)

  const send = useCallback(async (prompt: string, context?: Record<string, unknown>) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Reset state via registry
    registry.set(atoms.tree, { root: null, elements: {} })
    registry.set(atoms.isStreaming, true)
    registry.set(atoms.error, Option.none())

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let buffer = ""
      let root: string | null = null
      let elements: Record<string, unknown> = {}

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on newlines, keep incomplete line in buffer
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const op = JSON.parse(line)

            // Apply operation to tree
            if (op.op === "set" && op.path === "/root") {
              root = op.value
            } else if (op.op === "add" && op.path.startsWith("/elements/")) {
              const key = op.path.replace("/elements/", "")
              elements = { ...elements, [key]: op.value }
            }
          } catch {
            // Skip parse errors for incomplete JSON
          }
        }

        // Update atom with current tree state
        registry.set(atoms.tree, { root, elements })
      }

      // Handle any remaining buffer
      if (buffer.trim()) {
        try {
          const op = JSON.parse(buffer)
          if (op.op === "set" && op.path === "/root") {
            root = op.value
          } else if (op.op === "add" && op.path.startsWith("/elements/")) {
            const key = op.path.replace("/elements/", "")
            elements = { ...elements, [key]: op.value }
          }
        } catch {
          // Skip
        }
      }

      // Final state update
      registry.set(atoms.tree, { root, elements })
      registry.set(atoms.isStreaming, false)

      return { root, elements }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Cancelled, not an error
        return undefined
      }
      const error = err instanceof Error ? err : new Error(String(err))
      registry.set(atoms.isStreaming, false)
      registry.set(atoms.error, Option.some(error))
      logError(`[useContainerUIStream] ${error.message}`)
      return undefined
    }
  }, [api, atoms, registry])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Reset atoms on unmount (GC will handle cleanup via Atom.family WeakRef)
      registry.set(atoms.tree, { root: null, elements: {} })
      registry.set(atoms.isStreaming, false)
      registry.set(atoms.error, Option.none())
    }
  }, [atoms, registry])

  return {
    tree,
    isStreaming,
    error,
    send,
  }
}

// =============================================================================
// Fallback Components
// =============================================================================

/**
 * Shown when max depth is reached
 */
function MaxDepthFallback({ depth }: { depth: number }) {
  return (
    <div className="p-3 border border-dashed border-amber-500/50 rounded-md bg-amber-500/5">
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Max nesting depth reached (depth: {depth})
      </p>
    </div>
  )
}

/**
 * Shown on generation error
 */
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="p-3 border border-dashed border-red-500/50 rounded-md bg-red-500/5">
      <p className="text-xs text-red-600 dark:text-red-400 font-medium">
        Generation failed
      </p>
      <p className="text-xs text-red-500/70 mt-1">
        {error.message}
      </p>
    </div>
  )
}

/**
 * Loading state with skeleton
 */
function GenerativeLoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="h-8 bg-muted rounded w-full" />
    </div>
  )
}

/**
 * Text fallback for max depth when specified via props
 */
function FallbackText({ text }: { text: string }) {
  return (
    <div className="p-2 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

// =============================================================================
// GenerativeContainer Props
// =============================================================================

export interface GenerativeContainerProps {
  /** Prompt to send to AI for generation */
  prompt: string
  /** Additional context to pass with prompt */
  context?: Record<string, unknown>
  /** Custom fallback when at max depth or on error */
  fallback?: ReactNode
  /** Maximum nesting depth (default: 3) */
  maxDepth?: number
  /** Component registry for rendering */
  registry: ComponentRegistry
  /** Action handler for rendered components */
  onAction?: (action: Action) => void
  /** Whether parent is loading (passed to children) */
  loading?: boolean
  /** API endpoint for generation */
  api?: string
}

// =============================================================================
// GenerativeContainer Component
// =============================================================================

/**
 * Recursive AI-generated UI container
 *
 * Streams UI from an AI endpoint and renders the result using the
 * provided component registry. Supports nesting up to maxDepth levels.
 *
 * States:
 * 1. At max depth → shows fallback
 * 2. Streaming → shows loading skeleton
 * 3. Error → shows error fallback
 * 4. Success → renders nested UITree
 *
 * @example
 * ```tsx
 * <GenerativeContainer
 *   prompt="Generate a user dashboard with metrics"
 *   registry={tmnlRegistry}
 *   maxDepth={2}
 * />
 * ```
 */
export function GenerativeContainer({
  prompt,
  context,
  fallback,
  maxDepth,
  registry,
  onAction,
  loading: parentLoading,
  api,
}: GenerativeContainerProps) {
  const depthContext = useGenerativeDepth()

  // Generate unique ID for this container instance (Atom.family key)
  const containerId = useId()

  // Calculate effective max depth
  const effectiveMaxDepth = maxDepth ?? depthContext.maxDepth ?? DEFAULT_MAX_DEPTH
  const isAtMaxDepth = depthContext.depth >= effectiveMaxDepth

  // Debug: Log mount
  log(`[GenerativeContainer] MOUNT id=${containerId} depth=${depthContext.depth} maxDepth=${effectiveMaxDepth} isAtMaxDepth=${isAtMaxDepth}`)
  log(`[GenerativeContainer] prompt="${prompt?.substring(0, 60)}..."`)
  logDebug(`[GenerativeContainer] api=${api ?? DEFAULT_API}`)

  // Stream hook for AI generation - uses Atom.family for per-container isolation
  const {
    tree,
    isStreaming,
    error,
    send,
  } = useContainerUIStream(containerId, api ?? DEFAULT_API)

  // Debug: Log state changes
  log(`[GenerativeContainer] STATE depth=${depthContext.depth} streaming=${isStreaming} hasRoot=${!!tree.root} elements=${Object.keys(tree.elements).length} error=${Option.isSome(error)}`)

  // Trigger generation on mount (only if not at max depth)
  useEffect(() => {
    logDebug(`[GenerativeContainer] useEffect triggered depth=${depthContext.depth} isAtMaxDepth=${isAtMaxDepth}`)

    if (isAtMaxDepth) {
      logDebug(`[GenerativeContainer] SKIPPED - at max depth`)
      return
    }

    // Build context with depth info
    const enrichedContext = {
      ...context,
      _depth: depthContext.depth,
      _parentPrompts: depthContext.parentPrompts,
    }

    logDebug(`[GenerativeContainer] SENDING prompt="${prompt?.substring(0, 60)}..." context=${JSON.stringify(enrichedContext)}`)
    send(prompt, enrichedContext)
  }, []) // Intentionally only on mount - prompt changes don't retrigger

  // Memoize the nested registry that includes GenerativeContainer
  const nestedRegistry = useMemo(() => {
    // Ensure nested containers use the same registry
    return {
      ...registry,
      GenerativeContainer: createGenerativeContainerRenderer(registry, api),
    }
  }, [registry, api])

  // ─────────────────────────────────────────────────────────────────────────────
  // Render States
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. At max depth → fallback
  if (isAtMaxDepth) {
    logDebug(`[GenerativeContainer] RENDER: MaxDepthFallback depth=${depthContext.depth}`)
    return <>{fallback ?? <MaxDepthFallback depth={depthContext.depth} />}</>
  }

  // 2. Error → fallback
  if (Option.isSome(error)) {
    const errorValue = error.value as Error
    logDebug(`[GenerativeContainer] RENDER: ErrorFallback depth=${depthContext.depth} error=${errorValue.message}`)
    return <>{fallback ?? <ErrorFallback error={errorValue} />}</>
  }

  // 3. No tree yet (still starting) → skeleton
  if (!tree.root) {
    logDebug(`[GenerativeContainer] RENDER: LoadingSkeleton depth=${depthContext.depth}`)
    return <GenerativeLoadingSkeleton />
  }

  // 4. Success → render nested tree wrapped in depth provider
  logDebug(`[GenerativeContainer] RENDER: Success depth=${depthContext.depth} root=${tree.root} elements=${Object.keys(tree.elements).length}`)
  return (
    <GenerativeDepthProvider maxDepth={effectiveMaxDepth} prompt={prompt}>
      <Renderer
        tree={tree as any}  // Cast: Renderer only uses .root and .elements which we provide
        registry={nestedRegistry}
        loading={isStreaming || parentLoading}
        onAction={onAction}
      />
    </GenerativeDepthProvider>
  )
}

// =============================================================================
// Registry Wrapper Factory
// =============================================================================

/**
 * Creates a renderer function for GenerativeContainer that can be added to a registry.
 *
 * Handles the circular reference issue: GenerativeContainer needs a registry,
 * but the registry needs GenerativeContainer.
 *
 * @param registry - The component registry to use for nested rendering
 * @param defaultApi - Default API endpoint (can be overridden per-container)
 *
 * @example
 * ```tsx
 * const registry: ComponentRegistry = {
 *   // ... other components
 * }
 *
 * // Add GenerativeContainer after registry is defined
 * registry.GenerativeContainer = createGenerativeContainerRenderer(registry)
 * ```
 */
export function createGenerativeContainerRenderer(
  registry: ComponentRegistry,
  defaultApi?: string
) {
  logDebug(`[createGenerativeContainerRenderer] Factory called with defaultApi=${defaultApi}`)

  return function GenerativeContainerRenderer({
    element,
    onAction,
    loading,
  }: {
    element: { props: Record<string, unknown> }
    onAction?: (action: Action) => void
    loading?: boolean
  }) {
    logDebug(`[GenerativeContainerRenderer] Rendering element: ${JSON.stringify(element.props)}`)

    const prompt = element.props['prompt'] as string
    const context = element.props['context'] as Record<string, unknown> | undefined
    const maxDepth = element.props['maxDepth'] as number | undefined
    const fallbackText = element.props['fallbackText'] as string | undefined
    const api = element.props['api'] as string | undefined

    // Validate prompt is present
    if (!prompt) {
      logError(`[GenerativeContainerRenderer] ERROR: No prompt provided! props=${JSON.stringify(element.props)}`)
      return (
        <div className="p-2 text-xs text-red-500">
          GenerativeContainer requires a "prompt" prop
        </div>
      )
    }

    logDebug(`[GenerativeContainerRenderer] Creating GenerativeContainer with prompt="${prompt.substring(0, 60)}..."`)

    return (
      <GenerativeContainer
        prompt={prompt}
        context={context}
        maxDepth={maxDepth}
        fallback={fallbackText ? <FallbackText text={fallbackText} /> : undefined}
        registry={registry}
        onAction={onAction}
        loading={loading}
        api={api ?? defaultApi}
      />
    )
  }
}
