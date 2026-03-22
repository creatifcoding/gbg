/**
 * @module layout/hooks/useBreakpoint
 * @description Hook for evaluating breakpoints based on container size
 */

import { useMemo } from "react"
import { evaluateBreakpoints, type BreakpointResult } from "../services"
import type { LayoutBreakpoints } from "../schemas"
import { useContainerWidth, type UseContainerSizeOptions } from "./useContainerSize"

/**
 * Options for useBreakpoint
 */
export interface UseBreakpointOptions extends Omit<UseContainerSizeOptions, "onResize"> {
  /** Breakpoints to evaluate */
  breakpoints: LayoutBreakpoints
  /** Default template when no breakpoints match */
  defaultTemplate: string
  /** Default gap when no breakpoints match */
  defaultGap?: number
  /** Callback when breakpoint changes */
  onBreakpointChange?: (result: BreakpointResult) => void
}

/**
 * Hook to evaluate breakpoints based on container width
 *
 * @example
 * ```tsx
 * function ResponsiveGrid() {
 *   const { ref, result } = useBreakpoint({
 *     breakpoints: [
 *       { condition: { _tag: "MinWidthCondition", minWidth: 768 }, template: "1fr 1fr" },
 *       { condition: { _tag: "MinWidthCondition", minWidth: 1024 }, template: "1fr 1fr 1fr" },
 *     ],
 *     defaultTemplate: "1fr",
 *   })
 *
 *   return (
 *     <div ref={ref} style={{ gridTemplateColumns: result.template }}>
 *       ...
 *     </div>
 *   )
 * }
 * ```
 */
export function useBreakpoint<T extends HTMLElement = HTMLDivElement>(
  options: UseBreakpointOptions
): {
  ref: React.RefObject<T>
  width: number
  result: BreakpointResult
} {
  const {
    breakpoints,
    defaultTemplate,
    defaultGap,
    onBreakpointChange,
    ...containerOptions
  } = options

  const { ref, width } = useContainerWidth<T>({
    ...containerOptions,
    onResize: (newWidth) => {
      const newResult = evaluateBreakpoints(
        newWidth,
        breakpoints,
        defaultTemplate,
        defaultGap
      )
      onBreakpointChange?.(newResult)
    },
  })

  const result = useMemo(
    () => evaluateBreakpoints(width, breakpoints, defaultTemplate, defaultGap),
    [width, breakpoints, defaultTemplate, defaultGap]
  )

  return { ref, width, result }
}

/**
 * Hook to get the current breakpoint template string
 * Simplified version that just returns the template
 */
export function useBreakpointTemplate<T extends HTMLElement = HTMLDivElement>(
  breakpoints: LayoutBreakpoints,
  defaultTemplate: string
): {
  ref: React.RefObject<T>
  template: string
} {
  const { ref, result } = useBreakpoint<T>({
    breakpoints,
    defaultTemplate,
  })
  return { ref, template: result.template }
}

/**
 * Hook variant for mobile-first responsive design
 * Automatically sorts breakpoints by minWidth descending
 */
export function useMobileFirst<T extends HTMLElement = HTMLDivElement>(
  breakpoints: Array<{ minWidth: number; template: string; gap?: number }>,
  defaultTemplate: string,
  defaultGap?: number
): {
  ref: React.RefObject<T>
  width: number
  result: BreakpointResult
} {
  // Convert to LayoutBreakpoints format and sort descending
  const sortedBreakpoints = useMemo((): LayoutBreakpoints => {
    return [...breakpoints]
      .sort((a, b) => b.minWidth - a.minWidth)
      .map((bp) => ({
        condition: { _tag: "MinWidthCondition" as const, minWidth: bp.minWidth },
        template: bp.template,
        gap: bp.gap,
      }))
  }, [breakpoints])

  return useBreakpoint<T>({
    breakpoints: sortedBreakpoints,
    defaultTemplate,
    defaultGap,
  })
}

/**
 * Hook variant for desktop-first responsive design
 * Automatically sorts breakpoints by maxWidth ascending
 */
export function useDesktopFirst<T extends HTMLElement = HTMLDivElement>(
  breakpoints: Array<{ maxWidth: number; template: string; gap?: number }>,
  defaultTemplate: string,
  defaultGap?: number
): {
  ref: React.RefObject<T>
  width: number
  result: BreakpointResult
} {
  // Convert to LayoutBreakpoints format and sort ascending
  const sortedBreakpoints = useMemo((): LayoutBreakpoints => {
    return [...breakpoints]
      .sort((a, b) => a.maxWidth - b.maxWidth)
      .map((bp) => ({
        condition: { _tag: "MaxWidthCondition" as const, maxWidth: bp.maxWidth },
        template: bp.template,
        gap: bp.gap,
      }))
  }, [breakpoints])

  return useBreakpoint<T>({
    breakpoints: sortedBreakpoints,
    defaultTemplate,
    defaultGap,
  })
}

/**
 * Create a typed breakpoint hook for a specific set of breakpoints
 * Useful for creating reusable responsive patterns
 */
export function createBreakpointHook<
  K extends string,
  T extends HTMLElement = HTMLDivElement
>(config: {
  breakpoints: Record<K, { minWidth?: number; maxWidth?: number; template: string; gap?: number }>
  defaultTemplate: string
  defaultGap?: number
}): () => {
  ref: React.RefObject<T>
  width: number
  result: BreakpointResult
  currentBreakpoint: K | "default"
} {
  const { breakpoints, defaultTemplate, defaultGap } = config

  // Convert record to array
  const breakpointArray: LayoutBreakpoints = Object.entries(breakpoints).map(
    ([_key, value]) => {
      const bp = value as { minWidth?: number; maxWidth?: number; template: string; gap?: number }
      if (bp.minWidth !== undefined && bp.maxWidth !== undefined) {
        return {
          condition: {
            _tag: "RangeWidthCondition" as const,
            minWidth: bp.minWidth,
            maxWidth: bp.maxWidth,
          },
          template: bp.template,
          gap: bp.gap,
        }
      } else if (bp.minWidth !== undefined) {
        return {
          condition: { _tag: "MinWidthCondition" as const, minWidth: bp.minWidth },
          template: bp.template,
          gap: bp.gap,
        }
      } else if (bp.maxWidth !== undefined) {
        return {
          condition: { _tag: "MaxWidthCondition" as const, maxWidth: bp.maxWidth },
          template: bp.template,
          gap: bp.gap,
        }
      }
      throw new Error("Breakpoint must have minWidth, maxWidth, or both")
    }
  )

  const keys = Object.keys(breakpoints) as K[]

  return function useCustomBreakpoint() {
    const { ref, width, result } = useBreakpoint<T>({
      breakpoints: breakpointArray,
      defaultTemplate,
      defaultGap,
    })

    const currentBreakpoint: K | "default" =
      result.matchedIndex >= 0 ? keys[result.matchedIndex] : "default"

    return { ref, width, result, currentBreakpoint }
  }
}
