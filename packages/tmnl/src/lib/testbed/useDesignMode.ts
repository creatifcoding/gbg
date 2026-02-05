/**
 * useDesignMode Hook
 *
 * Provides access to design mode state and operations for component styling.
 * Used by ComponentBox and external design tools.
 */

import * as React from 'react'
import type { CSSProperties } from 'react'
import { useTestbed, useTestbedOptional } from './TestbedProvider'

// =============================================================================
// Types
// =============================================================================

export interface DesignModeHook {
  /** Whether design mode is currently active */
  isActive: boolean
  /** Toggle design mode on/off */
  toggleActive: () => void
  /** Set design mode active state directly */
  setActive: (active: boolean) => void
  /** Currently selected component ID */
  selectedComponentId: string | null
  /** Select a component by ID */
  selectComponent: (id: string | null) => void

  // Style Overrides
  /** Get style overrides for a component */
  getStyleOverrides: (componentId: string) => CSSProperties | undefined
  /** Apply style override to a component (merges with existing) */
  applyStyleOverride: (componentId: string, styles: CSSProperties) => void
  /** Set complete style override for a component (replaces existing) */
  setStyleOverride: (componentId: string, styles: CSSProperties) => void
  /** Check if component has style overrides */
  hasStyleOverrides: (componentId: string) => boolean

  // Prop Overrides
  /** Get all prop overrides for a component */
  getPropOverrides: (componentId: string) => Record<string, unknown>
  /** Get a specific prop override value */
  getPropOverride: <T>(componentId: string, propName: string) => T | undefined
  /** Apply a prop override */
  applyPropOverride: (componentId: string, propName: string, value: unknown) => void
  /** Check if component has prop overrides */
  hasPropOverrides: (componentId: string) => boolean

  // Reset
  /** Reset all overrides for a component */
  resetOverrides: (componentId: string) => void
  /** Reset all overrides across all components */
  resetAllOverrides: () => void

  // Utilities
  /** Get all style overrides map */
  allStyleOverrides: Map<string, CSSProperties>
  /** Get all prop overrides map */
  allPropOverrides: Map<string, unknown>
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook to access and manipulate design mode state.
 * Must be used within a TestbedProvider.
 *
 * @example
 * ```tsx
 * const {
 *   isActive,
 *   toggleActive,
 *   applyStyleOverride,
 *   applyPropOverride,
 *   resetOverrides,
 * } = useDesignMode()
 *
 * // Apply style override
 * applyStyleOverride('my-button', { backgroundColor: 'red' })
 *
 * // Apply prop override
 * applyPropOverride('my-button', 'disabled', true)
 *
 * // Reset component overrides
 * resetOverrides('my-button')
 * ```
 */
export function useDesignMode(): DesignModeHook {
  const ctx = useTestbed()
  const { designMode, setDesignModeActive, applyStyleOverride, applyPropOverride, clearOverrides, clearAllOverrides, selectComponent } = ctx

  // Extract primitives to avoid dependency on entire designMode object
  const isActive = designMode.active
  const selectedComponentId = designMode.selectedComponentId
  const styleOverrides = designMode.styleOverrides
  const propOverrides = designMode.propOverrides

  const toggleActive = React.useCallback(() => {
    setDesignModeActive(!isActive)
  }, [setDesignModeActive, isActive])

  const setActive = React.useCallback(
    (active: boolean) => {
      setDesignModeActive(active)
    },
    [setDesignModeActive]
  )

  const getStyleOverrides = React.useCallback(
    (componentId: string): CSSProperties | undefined => {
      return styleOverrides.get(componentId)
    },
    [styleOverrides]
  )

  const setStyleOverride = React.useCallback(
    (componentId: string, styles: CSSProperties) => {
      // Clear existing and set new
      clearOverrides(componentId)
      applyStyleOverride(componentId, styles)
    },
    [clearOverrides, applyStyleOverride]
  )

  const hasStyleOverrides = React.useCallback(
    (componentId: string): boolean => {
      return styleOverrides.has(componentId)
    },
    [styleOverrides]
  )

  const getPropOverrides = React.useCallback(
    (componentId: string): Record<string, unknown> => {
      const result: Record<string, unknown> = {}
      const prefix = `${componentId}:`

      for (const [key, value] of propOverrides) {
        if (key.startsWith(prefix)) {
          const propName = key.slice(prefix.length)
          result[propName] = value
        }
      }

      return result
    },
    [propOverrides]
  )

  const getPropOverride = React.useCallback(
    <T,>(componentId: string, propName: string): T | undefined => {
      return propOverrides.get(`${componentId}:${propName}`) as T | undefined
    },
    [propOverrides]
  )

  const hasPropOverrides = React.useCallback(
    (componentId: string): boolean => {
      const prefix = `${componentId}:`
      for (const key of propOverrides.keys()) {
        if (key.startsWith(prefix)) {
          return true
        }
      }
      return false
    },
    [propOverrides]
  )

  const resetOverrides = React.useCallback(
    (componentId: string) => {
      clearOverrides(componentId)
    },
    [clearOverrides]
  )

  const resetAllOverrides = React.useCallback(() => {
    clearAllOverrides()
  }, [clearAllOverrides])

  // CRITICAL: Memoize the return object to prevent infinite loops
  // Per Vercel React best practices: rerender-memo
  return React.useMemo(
    () => ({
      isActive,
      toggleActive,
      setActive,
      selectedComponentId,
      selectComponent,
      getStyleOverrides,
      applyStyleOverride,
      setStyleOverride,
      hasStyleOverrides,
      getPropOverrides,
      getPropOverride,
      applyPropOverride,
      hasPropOverrides,
      resetOverrides,
      resetAllOverrides,
      allStyleOverrides: styleOverrides,
      allPropOverrides: propOverrides,
    }),
    [
      isActive,
      toggleActive,
      setActive,
      selectedComponentId,
      selectComponent,
      getStyleOverrides,
      applyStyleOverride,
      setStyleOverride,
      hasStyleOverrides,
      getPropOverrides,
      getPropOverride,
      applyPropOverride,
      hasPropOverrides,
      resetOverrides,
      resetAllOverrides,
      styleOverrides,
      propOverrides,
    ]
  )
}

// =============================================================================
// Optional Hook (for components that may be outside provider)
// =============================================================================

/**
 * Stable empty maps and no-op functions for fallback context
 */
const EMPTY_STYLE_MAP = new Map<string, React.CSSProperties>()
const EMPTY_PROP_MAP = new Map<string, unknown>()
const NOOP = () => {}
const NOOP_STYLE_APPLY = (_id: string, _styles: React.CSSProperties) => {}
const NOOP_PROP_APPLY = (_id: string, _prop: string, _value: unknown) => {}
const NOOP_SELECT = (_id: string | null) => {}

/**
 * Optional version of useDesignMode that returns empty stub if outside TestbedProvider.
 * Uses stable empty object to avoid re-render issues.
 *
 * CRITICAL: Always calls the same hooks regardless of context presence.
 * This ensures Rules of Hooks compliance across portal boundaries.
 */
export function useDesignModeOptional(): DesignModeHook {
  const ctx = useTestbedOptional()
  const hasContext = ctx !== null

  // ALWAYS create stable callbacks regardless of context
  // This ensures consistent hook count across renders
  const { designMode, setDesignModeActive, applyStyleOverride, applyPropOverride, clearOverrides, clearAllOverrides, selectComponent } =
    ctx ?? {
      designMode: { active: false, styleOverrides: EMPTY_STYLE_MAP, propOverrides: EMPTY_PROP_MAP, selectedComponentId: null },
      setDesignModeActive: NOOP,
      applyStyleOverride: NOOP_STYLE_APPLY,
      applyPropOverride: NOOP_PROP_APPLY,
      clearOverrides: NOOP,
      clearAllOverrides: NOOP,
      selectComponent: NOOP_SELECT,
    }

  const isActive = designMode.active
  const selectedComponentId = designMode.selectedComponentId
  const styleOverrides = designMode.styleOverrides
  const propOverrides = designMode.propOverrides

  const toggleActive = React.useCallback(() => {
    if (hasContext) setDesignModeActive(!isActive)
  }, [hasContext, setDesignModeActive, isActive])

  const setActive = React.useCallback(
    (active: boolean) => {
      if (hasContext) setDesignModeActive(active)
    },
    [hasContext, setDesignModeActive]
  )

  const getStyleOverrides = React.useCallback(
    (componentId: string): CSSProperties | undefined => {
      return styleOverrides.get(componentId)
    },
    [styleOverrides]
  )

  const setStyleOverride = React.useCallback(
    (componentId: string, styles: CSSProperties) => {
      if (hasContext) {
        clearOverrides(componentId)
        applyStyleOverride(componentId, styles)
      }
    },
    [hasContext, clearOverrides, applyStyleOverride]
  )

  const hasStyleOverridesCheck = React.useCallback(
    (componentId: string): boolean => {
      return styleOverrides.has(componentId)
    },
    [styleOverrides]
  )

  const getPropOverrides = React.useCallback(
    (componentId: string): Record<string, unknown> => {
      const result: Record<string, unknown> = {}
      const prefix = `${componentId}:`
      for (const [key, value] of propOverrides) {
        if (key.startsWith(prefix)) {
          const propName = key.slice(prefix.length)
          result[propName] = value
        }
      }
      return result
    },
    [propOverrides]
  )

  const getPropOverride = React.useCallback(
    <T,>(componentId: string, propName: string): T | undefined => {
      return propOverrides.get(`${componentId}:${propName}`) as T | undefined
    },
    [propOverrides]
  )

  const hasPropOverridesCheck = React.useCallback(
    (componentId: string): boolean => {
      const prefix = `${componentId}:`
      for (const key of propOverrides.keys()) {
        if (key.startsWith(prefix)) return true
      }
      return false
    },
    [propOverrides]
  )

  const resetOverrides = React.useCallback(
    (componentId: string) => {
      if (hasContext) clearOverrides(componentId)
    },
    [hasContext, clearOverrides]
  )

  const resetAllOverrides = React.useCallback(() => {
    if (hasContext) clearAllOverrides()
  }, [hasContext, clearAllOverrides])

  const selectComponentWrapped = React.useCallback(
    (id: string | null) => {
      if (hasContext) selectComponent(id)
    },
    [hasContext, selectComponent]
  )

  return React.useMemo(
    () => ({
      isActive,
      toggleActive,
      setActive,
      selectedComponentId,
      selectComponent: selectComponentWrapped,
      getStyleOverrides,
      applyStyleOverride,
      setStyleOverride,
      hasStyleOverrides: hasStyleOverridesCheck,
      getPropOverrides,
      getPropOverride,
      applyPropOverride,
      hasPropOverrides: hasPropOverridesCheck,
      resetOverrides,
      resetAllOverrides,
      allStyleOverrides: styleOverrides,
      allPropOverrides: propOverrides,
    }),
    [
      isActive,
      toggleActive,
      setActive,
      selectedComponentId,
      selectComponentWrapped,
      getStyleOverrides,
      applyStyleOverride,
      setStyleOverride,
      hasStyleOverridesCheck,
      getPropOverrides,
      getPropOverride,
      applyPropOverride,
      hasPropOverridesCheck,
      resetOverrides,
      resetAllOverrides,
      styleOverrides,
      propOverrides,
    ]
  )
}

// =============================================================================
// Component-Specific Hook
// =============================================================================

export interface ComponentDesignState {
  /** Whether this component is currently selected in design mode */
  isSelected: boolean
  /** Style overrides for this component */
  styleOverrides: CSSProperties | undefined
  /** Prop overrides for this component */
  propOverrides: Record<string, unknown>
  /** Whether design mode is active */
  designModeActive: boolean
  /** Select this component */
  select: () => void
  /** Deselect this component */
  deselect: () => void
  /** Apply style override to this component */
  applyStyle: (styles: CSSProperties) => void
  /** Apply prop override to this component */
  applyProp: (propName: string, value: unknown) => void
  /** Reset all overrides for this component */
  reset: () => void
}

/**
 * Hook to get design state for a specific component.
 * Scoped to a single component ID for convenience.
 *
 * @param componentId - The component ID to get state for
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const design = useComponentDesignState('my-component')
 *
 *   return (
 *     <div
 *       style={{
 *         ...baseStyles,
 *         ...design.styleOverrides,
 *         outline: design.isSelected ? '2px solid blue' : undefined,
 *       }}
 *     >
 *       Content
 *     </div>
 *   )
 * }
 * ```
 */
export function useComponentDesignState(componentId: string): ComponentDesignState {
  const design = useDesignMode()

  // Extract stable function references to avoid depending on entire `design` object
  // Per Vercel React best practices: rerender-dependencies (use primitives)
  const {
    selectedComponentId,
    isActive,
    selectComponent,
    applyStyleOverride,
    applyPropOverride,
    resetOverrides,
    // Get the raw Maps for stable references - don't call getters during render
    allStyleOverrides,
    allPropOverrides,
  } = design

  const isSelected = selectedComponentId === componentId

  // CRITICAL: Memoize derived values to prevent infinite loops
  // allStyleOverrides.get() returns undefined or existing object (stable)
  const styleOverrides = React.useMemo(
    () => allStyleOverrides.get(componentId),
    [allStyleOverrides, componentId]
  )

  // getPropOverrides creates NEW object each call - must memoize
  const propOverrides = React.useMemo(() => {
    const result: Record<string, unknown> = {}
    const prefix = `${componentId}:`
    for (const [key, value] of allPropOverrides) {
      if (key.startsWith(prefix)) {
        const propName = key.slice(prefix.length)
        result[propName] = value
      }
    }
    return result
  }, [allPropOverrides, componentId])

  // Use stable references from destructuring, not the `design` object
  const select = React.useCallback(() => {
    selectComponent(componentId)
  }, [selectComponent, componentId])

  const deselect = React.useCallback(() => {
    if (selectedComponentId === componentId) {
      selectComponent(null)
    }
  }, [selectComponent, selectedComponentId, componentId])

  const applyStyle = React.useCallback(
    (styles: CSSProperties) => {
      applyStyleOverride(componentId, styles)
    },
    [applyStyleOverride, componentId]
  )

  const applyProp = React.useCallback(
    (propName: string, value: unknown) => {
      applyPropOverride(componentId, propName, value)
    },
    [applyPropOverride, componentId]
  )

  const reset = React.useCallback(() => {
    resetOverrides(componentId)
  }, [resetOverrides, componentId])

  // Memoize return to prevent downstream re-renders
  return React.useMemo(
    () => ({
      isSelected,
      styleOverrides,
      propOverrides,
      designModeActive: isActive,
      select,
      deselect,
      applyStyle,
      applyProp,
      reset,
    }),
    [
      isSelected,
      styleOverrides,
      propOverrides,
      isActive,
      select,
      deselect,
      applyStyle,
      applyProp,
      reset,
    ]
  )
}

/**
 * Optional version of useComponentDesignState for components outside provider.
 * Returns stable empty state when outside TestbedProvider.
 *
 * CRITICAL: Always calls the same hooks regardless of context presence.
 * This ensures Rules of Hooks compliance across portal boundaries (Radix Dialog).
 */
export function useComponentDesignStateOptional(
  componentId: string
): ComponentDesignState {
  const ctx = useTestbedOptional()
  const hasContext = ctx !== null

  // Extract from context or use empty defaults
  const designMode = ctx?.designMode ?? {
    active: false,
    styleOverrides: EMPTY_STYLE_MAP,
    propOverrides: EMPTY_PROP_MAP,
    selectedComponentId: null,
  }
  const selectComponentFn = ctx?.selectComponent ?? NOOP_SELECT
  const applyStyleOverrideFn = ctx?.applyStyleOverride ?? NOOP_STYLE_APPLY
  const applyPropOverrideFn = ctx?.applyPropOverride ?? NOOP_PROP_APPLY
  const clearOverridesFn = ctx?.clearOverrides ?? NOOP

  const { selectedComponentId, active: isActive, styleOverrides: allStyleOverrides, propOverrides: allPropOverrides } = designMode

  const isSelected = selectedComponentId === componentId

  // Memoize derived values
  const styleOverrides = React.useMemo(
    () => allStyleOverrides.get(componentId),
    [allStyleOverrides, componentId]
  )

  const propOverrides = React.useMemo(() => {
    const result: Record<string, unknown> = {}
    const prefix = `${componentId}:`
    for (const [key, value] of allPropOverrides) {
      if (key.startsWith(prefix)) {
        const propName = key.slice(prefix.length)
        result[propName] = value
      }
    }
    return result
  }, [allPropOverrides, componentId])

  const select = React.useCallback(() => {
    if (hasContext) selectComponentFn(componentId)
  }, [hasContext, selectComponentFn, componentId])

  const deselect = React.useCallback(() => {
    if (hasContext && selectedComponentId === componentId) {
      selectComponentFn(null)
    }
  }, [hasContext, selectComponentFn, selectedComponentId, componentId])

  const applyStyle = React.useCallback(
    (styles: CSSProperties) => {
      if (hasContext) applyStyleOverrideFn(componentId, styles)
    },
    [hasContext, applyStyleOverrideFn, componentId]
  )

  const applyProp = React.useCallback(
    (propName: string, value: unknown) => {
      if (hasContext) applyPropOverrideFn(componentId, propName, value)
    },
    [hasContext, applyPropOverrideFn, componentId]
  )

  const reset = React.useCallback(() => {
    if (hasContext) clearOverridesFn(componentId)
  }, [hasContext, clearOverridesFn, componentId])

  return React.useMemo(
    () => ({
      isSelected,
      styleOverrides,
      propOverrides,
      designModeActive: isActive,
      select,
      deselect,
      applyStyle,
      applyProp,
      reset,
    }),
    [
      isSelected,
      styleOverrides,
      propOverrides,
      isActive,
      select,
      deselect,
      applyStyle,
      applyProp,
      reset,
    ]
  )
}

export default useDesignMode
