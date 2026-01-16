/**
 * @module layout/components/Grid
 * @description CSS Grid layout with responsive breakpoints and optional resize
 */

import * as React from "react"
import { useCallback, useEffect, useId, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  createLayoutAtoms,
  disposeLayoutAtoms,
  type LayoutAtoms,
} from "../atoms"
import { useBreakpoint } from "../hooks"
import {
  equalRatios,
  ratiosToTemplate,
  spacingToCss,
  type GridAlignment,
  type LayoutBreakpoints,
  type SpacingToken,
} from "../schemas"
import { ResizeHandle } from "./ResizeHandle"
import { Registry } from "@effect-atom/atom"

/**
 * Grid component props
 */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique identifier (auto-generated if not provided) */
  id?: string
  /** Default grid template */
  template?: string
  /** Responsive breakpoints */
  breakpoints?: LayoutBreakpoints
  /** Gap between cells */
  gap?: SpacingToken
  /** Grid direction */
  direction?: "row" | "column"
  /** Align items */
  alignItems?: GridAlignment
  /** Justify items */
  justifyItems?: GridAlignment
  /** Enable resize handles */
  resizable?: boolean
  /** Initial ratios for resizable grid */
  initialRatios?: number[]
  /** Minimum ratio for cells */
  minRatio?: number
  /** Callback when ratios change */
  onRatiosChange?: (ratios: number[]) => void
  /** Registry for atom state (uses internal if not provided) */
  registry?: Registry.Registry
  /** Children */
  children: React.ReactNode
}

/**
 * Grid component
 *
 * A CSS Grid layout component with responsive breakpoints and optional
 * drag-to-resize functionality.
 *
 * @example
 * ```tsx
 * // Basic grid
 * <Grid template="1fr 1fr 1fr" gap={16}>
 *   <Card />
 *   <Card />
 *   <Card />
 * </Grid>
 *
 * // Responsive grid
 * <Grid
 *   template="1fr"
 *   breakpoints={[
 *     { condition: { _tag: "MinWidthCondition", minWidth: 768 }, template: "1fr 1fr" },
 *   ]}
 * >
 *   ...
 * </Grid>
 *
 * // Resizable grid
 * <Grid
 *   id="my-grid"
 *   resizable
 *   onRatiosChange={(ratios) => persist(ratios)}
 * >
 *   <Panel />
 *   <Panel />
 * </Grid>
 * ```
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  function Grid(
    {
      id: providedId,
      template = "1fr",
      breakpoints = [],
      gap = 16 as SpacingToken,
      direction = "row",
      alignItems,
      justifyItems,
      resizable = false,
      initialRatios,
      minRatio = 0.1,
      onRatiosChange,
      registry: externalRegistry,
      className,
      style,
      children,
      ...props
    },
    forwardedRef
  ) {
    const autoId = useId()
    const instanceId = providedId || autoId

    // Internal registry if not provided
    const internalRegistry = useMemo(() => Registry.make(), [])
    const registry = externalRegistry || internalRegistry

    // Count children for resize setup
    const childCount = React.Children.count(children)

    // Breakpoint evaluation
    const { ref: breakpointRef, width: containerWidth, result: breakpointResult } =
      useBreakpoint<HTMLDivElement>({
        breakpoints,
        defaultTemplate: template,
        defaultGap: gap,
      })

    // Merge refs
    const mergedRef = useMergedRef(forwardedRef, breakpointRef)

    // Initialize atoms for resizable grid
    const atomsRef = React.useRef<LayoutAtoms | null>(null)

    useEffect(() => {
      if (!resizable) return

      const atoms = createLayoutAtoms(
        instanceId,
        childCount,
        initialRatios
      )
      atomsRef.current = atoms

      return () => {
        disposeLayoutAtoms(instanceId)
        atomsRef.current = null
      }
    }, [instanceId, childCount, resizable, initialRatios])

    // Get current ratios from atoms
    const ratios = useResizeRatios(registry, atomsRef.current, resizable, childCount)

    // Handle ratio changes
    const handleRatiosChange = useCallback(
      (newRatios: number[]) => {
        if (!atomsRef.current) return

        const currentState = registry.get(atomsRef.current.stateAtom)
        registry.set(atomsRef.current.stateAtom, {
          ...currentState,
          ratios: newRatios,
        })

        onRatiosChange?.(newRatios)
      },
      [registry, onRatiosChange]
    )

    // Calculate grid template
    const gridTemplate = useMemo(() => {
      if (resizable && ratios) {
        return ratiosToTemplate([...ratios])
      }
      return breakpointResult.template
    }, [resizable, ratios, breakpointResult.template])

    // Calculate gap
    const actualGap = breakpointResult.gap ?? gap

    // Grid styles
    const gridStyle: React.CSSProperties = useMemo(
      () => ({
        display: "grid",
        [direction === "row" ? "gridTemplateColumns" : "gridTemplateRows"]: gridTemplate,
        gap: spacingToCss(actualGap as SpacingToken),
        ...(alignItems && { alignItems }),
        ...(justifyItems && { justifyItems }),
        ...style,
      }),
      [direction, gridTemplate, actualGap, alignItems, justifyItems, style]
    )

    return (
      <div
        ref={mergedRef}
        className={cn("relative", className)}
        style={gridStyle}
        data-layout-id={instanceId}
        data-resizable={resizable}
        {...props}
      >
        {children}

        {/* Resize handles */}
        {resizable && ratios && containerWidth > 0 && (
          <>
            {ratios.slice(0, -1).map((_, index) => (
              <ResizeHandle
                key={`handle-${index}`}
                direction={direction === "row" ? "horizontal" : "vertical"}
                index={index}
                ratios={ratios}
                onRatiosChange={handleRatiosChange}
                onDragEnd={onRatiosChange}
                containerSize={containerWidth}
                minRatio={minRatio}
                gap={actualGap}
              />
            ))}
          </>
        )}
      </div>
    )
  }
)

Grid.displayName = "Grid"

// =============================================================================
// Internal Hooks
// =============================================================================

/**
 * Hook to get ratios from atoms (handles null atoms gracefully)
 */
function useResizeRatios(
  registry: Registry.Registry,
  atoms: LayoutAtoms | null,
  resizable: boolean,
  cellCount: number
): readonly number[] {
  const defaultRatios = useMemo(() => equalRatios(cellCount), [cellCount])

  // If not resizable or no atoms, return default
  if (!resizable || !atoms) {
    return defaultRatios
  }

  // Subscribe to atom changes
  // Note: This is a simplified version - in practice you'd use useAtomValue
  const state = registry.get(atoms.stateAtom)
  return state.ratios
}

/**
 * Merge multiple refs into one
 */
function useMergedRef<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return useCallback(
    (value: T) => {
      refs.forEach((ref) => {
        if (typeof ref === "function") {
          ref(value)
        } else if (ref != null) {
          // RefObject.current is writable in React 19+
          (ref as { current: T | null }).current = value
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs
  )
}
