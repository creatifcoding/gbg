/**
 * @module layout/services/BreakpointService
 * @description Service for evaluating breakpoint conditions
 */

import { Context, Effect, Layer, Match } from "effect"
import {
  type LayoutBreakpoint,
  type LayoutBreakpoints,
} from "../schemas"

// =============================================================================
// Types
// =============================================================================

/**
 * Result of breakpoint evaluation
 */
export interface BreakpointResult {
  /** Active template string */
  template: string
  /** Gap override if specified in matched breakpoint */
  gap: number | undefined
  /** Index of matched breakpoint (-1 if default) */
  matchedIndex: number
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * BreakpointService interface
 */
export class BreakpointService extends Context.Tag("BreakpointService")<
  BreakpointService,
  {
    /**
     * Evaluate breakpoints against container width
     * Returns the first matching breakpoint's template, or default if none match
     *
     * @param containerWidth - Container width in pixels
     * @param breakpoints - Array of breakpoints to evaluate (in order)
     * @param defaultTemplate - Default template if no breakpoints match
     * @param defaultGap - Default gap value
     */
    readonly evaluate: (
      containerWidth: number,
      breakpoints: LayoutBreakpoints,
      defaultTemplate: string,
      defaultGap?: number
    ) => Effect.Effect<BreakpointResult>

    /**
     * Check if a single condition matches
     */
    readonly matchesCondition: (
      containerWidth: number,
      breakpoint: LayoutBreakpoint
    ) => Effect.Effect<boolean>
  }
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Check if a breakpoint condition matches the container width
 */
const checkCondition = (
  containerWidth: number,
  breakpoint: LayoutBreakpoint
): boolean => {
  const condition = breakpoint.condition

  return Match.value(condition).pipe(
    Match.tag("MinWidthCondition", (c) => containerWidth >= c.minWidth),
    Match.tag("MaxWidthCondition", (c) => containerWidth <= c.maxWidth),
    Match.tag("RangeWidthCondition", (c) =>
      containerWidth >= c.minWidth && containerWidth <= c.maxWidth
    ),
    Match.exhaustive
  )
}

/**
 * Live implementation of BreakpointService
 */
export const BreakpointServiceLive = Layer.succeed(BreakpointService, {
  evaluate: (containerWidth, breakpoints, defaultTemplate, defaultGap) =>
    Effect.sync(() => {
      // Find first matching breakpoint
      for (let i = 0; i < breakpoints.length; i++) {
        const bp = breakpoints[i]
        if (checkCondition(containerWidth, bp)) {
          return {
            template: bp.template,
            gap: bp.gap,
            matchedIndex: i,
          }
        }
      }

      // No match - use defaults
      return {
        template: defaultTemplate,
        gap: defaultGap,
        matchedIndex: -1,
      }
    }),

  matchesCondition: (containerWidth, breakpoint) =>
    Effect.sync(() => checkCondition(containerWidth, breakpoint)),
})

// =============================================================================
// Standalone Functions (for non-Effect usage)
// =============================================================================

/**
 * Evaluate breakpoints synchronously (no Effect)
 * For use in React components without Effect context
 */
export function evaluateBreakpoints(
  containerWidth: number,
  breakpoints: LayoutBreakpoints,
  defaultTemplate: string,
  defaultGap?: number
): BreakpointResult {
  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i]
    if (checkCondition(containerWidth, bp)) {
      return {
        template: bp.template,
        gap: bp.gap,
        matchedIndex: i,
      }
    }
  }

  return {
    template: defaultTemplate,
    gap: defaultGap,
    matchedIndex: -1,
  }
}

/**
 * Create a mobile-first breakpoint evaluator
 * Breakpoints should be specified from smallest to largest minWidth
 */
export function createMobileFirstEvaluator(
  breakpoints: Array<{ minWidth: number; template: string; gap?: number }>
): (containerWidth: number, defaultTemplate: string, defaultGap?: number) => BreakpointResult {
  // Sort breakpoints by minWidth descending for mobile-first evaluation
  const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth)

  return (containerWidth, defaultTemplate, defaultGap) => {
    for (let i = 0; i < sorted.length; i++) {
      const bp = sorted[i]
      if (containerWidth >= bp.minWidth) {
        return {
          template: bp.template,
          gap: bp.gap,
          matchedIndex: breakpoints.indexOf(bp),
        }
      }
    }

    return {
      template: defaultTemplate,
      gap: defaultGap,
      matchedIndex: -1,
    }
  }
}

/**
 * Create a desktop-first breakpoint evaluator
 * Breakpoints should be specified from largest to smallest maxWidth
 */
export function createDesktopFirstEvaluator(
  breakpoints: Array<{ maxWidth: number; template: string; gap?: number }>
): (containerWidth: number, defaultTemplate: string, defaultGap?: number) => BreakpointResult {
  // Sort breakpoints by maxWidth ascending for desktop-first evaluation
  const sorted = [...breakpoints].sort((a, b) => a.maxWidth - b.maxWidth)

  return (containerWidth, defaultTemplate, defaultGap) => {
    for (let i = 0; i < sorted.length; i++) {
      const bp = sorted[i]
      if (containerWidth <= bp.maxWidth) {
        return {
          template: bp.template,
          gap: bp.gap,
          matchedIndex: breakpoints.indexOf(bp),
        }
      }
    }

    return {
      template: defaultTemplate,
      gap: defaultGap,
      matchedIndex: -1,
    }
  }
}
