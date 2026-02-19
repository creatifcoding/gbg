/**
 * @fileoverview Depth tracking context for recursive GenerativeContainers
 *
 * Provides React Context for tracking:
 * - Current nesting depth
 * - Maximum allowed depth
 * - Parent prompt chain (for context)
 *
 * Pattern: Context + Provider for hierarchical state
 */

"use client"

import { createContext, useContext, type ReactNode } from "react"

// =============================================================================
// Types
// =============================================================================

export interface GenerativeDepthContextValue {
  /** Current nesting depth (0 = root level) */
  depth: number
  /** Maximum allowed nesting depth */
  maxDepth: number
  /** Whether at maximum depth (no more nesting allowed) */
  isAtMaxDepth: boolean
  /** Chain of parent prompts for context inheritance */
  parentPrompts: readonly string[]
}

// =============================================================================
// Context
// =============================================================================

const defaultValue: GenerativeDepthContextValue = {
  depth: 0,
  maxDepth: 3,
  isAtMaxDepth: false,
  parentPrompts: [],
}

export const GenerativeDepthContext = createContext<GenerativeDepthContextValue>(defaultValue)

// =============================================================================
// Provider
// =============================================================================

export interface GenerativeDepthProviderProps {
  children: ReactNode
  /** Override max depth (inherits from parent if not specified) */
  maxDepth?: number
  /** Current container's prompt (added to chain) */
  prompt?: string
}

/**
 * Provider for depth tracking in nested GenerativeContainers
 *
 * Automatically increments depth and tracks prompt chain.
 * Child containers inherit maxDepth from parent unless overridden.
 *
 * @example
 * ```tsx
 * <GenerativeDepthProvider prompt="Generate user stats">
 *   <GenerativeContainer prompt="Show metrics" />
 * </GenerativeDepthProvider>
 * ```
 */
export function GenerativeDepthProvider({
  children,
  maxDepth,
  prompt,
}: GenerativeDepthProviderProps) {
  const parent = useContext(GenerativeDepthContext)

  const effectiveMaxDepth = maxDepth ?? parent.maxDepth
  const newDepth = parent.depth + 1

  const value: GenerativeDepthContextValue = {
    depth: newDepth,
    maxDepth: effectiveMaxDepth,
    isAtMaxDepth: newDepth >= effectiveMaxDepth,
    parentPrompts: prompt
      ? [prompt, ...parent.parentPrompts]
      : parent.parentPrompts,
  }

  return (
    <GenerativeDepthContext.Provider value={value}>
      {children}
    </GenerativeDepthContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access current generative depth context
 *
 * @returns Current depth context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { depth, isAtMaxDepth } = useGenerativeDepth()
 *   if (isAtMaxDepth) return <FallbackUI />
 *   return <NestedGeneration />
 * }
 * ```
 */
export function useGenerativeDepth(): GenerativeDepthContextValue {
  return useContext(GenerativeDepthContext)
}
