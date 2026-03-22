/**
 * GEOINT Panel Context Provider
 *
 * Provides panel-scoped state to GEOINT components via React Context.
 * Each GeointDashboardPanel instance wraps its children with this provider
 * to enable isolated, panel-specific atom access.
 *
 * Pattern:
 * ```tsx
 * <GeointPanelProvider panelId="panel-1">
 *   <GeointMap />
 *   <SearchPanel />
 * </GeointPanelProvider>
 * ```
 *
 * @module geoint/context/PanelContext
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  type PanelId,
  type GeointPanelAtoms,
  asPanelId,
  getPanelAtoms,
} from '../atoms/families'

// =============================================================================
// CONTEXT TYPE
// =============================================================================

/**
 * Panel context value provided to all components within a panel.
 */
export interface GeointPanelContextValue {
  /** Panel identifier */
  readonly panelId: PanelId
  /** Panel-scoped atoms */
  readonly atoms: GeointPanelAtoms
}

// =============================================================================
// CONTEXT
// =============================================================================

const GeointPanelContext = createContext<GeointPanelContextValue | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

export interface GeointPanelProviderProps {
  /** Unique panel identifier (converted to branded PanelId) */
  panelId: string
  /** Children components */
  children: ReactNode
}

/**
 * Provider for panel-scoped GEOINT atoms.
 *
 * Wrap each GeointDashboardPanel instance with this provider
 * to enable panel-isolated state. Components within the provider
 * can access panel-specific atoms via hooks.
 *
 * **Key Features**:
 * - Automatic atom memoization (same panelId → same atoms)
 * - Type-safe panel access
 * - Zero prop drilling
 *
 * @example
 * ```tsx
 * <GeointPanelProvider panelId="panel-1">
 *   <GeointMap />
 *   <SearchPanel />
 *   <EntityPanel />
 * </GeointPanelProvider>
 * ```
 *
 * @example Multiple panels
 * ```tsx
 * <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
 *   <GeointPanelProvider panelId="left">
 *     <GeointDashboard />
 *   </GeointPanelProvider>
 *   <GeointPanelProvider panelId="right">
 *     <GeointDashboard />
 *   </GeointPanelProvider>
 * </div>
 * ```
 */
export function GeointPanelProvider({
  panelId: rawPanelId,
  children,
}: GeointPanelProviderProps) {
  // Convert string to branded PanelId type
  const panelId = useMemo(() => asPanelId(rawPanelId), [rawPanelId])

  // Get panel-scoped atoms (memoized by Atom.family)
  const atoms = useMemo(() => getPanelAtoms(panelId), [panelId])

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<GeointPanelContextValue>(
    () => ({ panelId, atoms }),
    [panelId, atoms]
  )

  return (
    <GeointPanelContext.Provider value={value}>
      {children}
    </GeointPanelContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Access panel context.
 *
 * @throws Error if used outside GeointPanelProvider
 *
 * @example
 * ```tsx
 * function GeointMap() {
 *   const { panelId, atoms } = useGeointPanel()
 *   const viewport = useAtomValue(atoms.viewportAtom)
 *   return <DeckGL viewState={viewport} />
 * }
 * ```
 */
export function useGeointPanel(): GeointPanelContextValue {
  const ctx = useContext(GeointPanelContext)
  if (!ctx) {
    throw new Error(
      'useGeointPanel must be used within GeointPanelProvider. ' +
        'Wrap your GEOINT components with <GeointPanelProvider panelId="...">.'
    )
  }
  return ctx
}

/**
 * Access panel context safely (returns null if outside provider).
 *
 * Use this when a component may exist both inside and outside
 * a panel context (e.g., during migration or for standalone use).
 *
 * @example
 * ```tsx
 * function GeointMap() {
 *   const panelContext = useGeointPanelSafe()
 *
 *   // Fallback to global atoms if outside provider
 *   const viewport = useAtomValue(
 *     panelContext?.atoms.viewportAtom ?? globalViewportAtom
 *   )
 *
 *   return <DeckGL viewState={viewport} />
 * }
 * ```
 */
export function useGeointPanelSafe(): GeointPanelContextValue | null {
  return useContext(GeointPanelContext)
}

/**
 * Get panel ID from context.
 *
 * Convenience hook for components that only need the panelId.
 *
 * @throws Error if used outside GeointPanelProvider
 *
 * @example
 * ```tsx
 * function PanelDebugInfo() {
 *   const panelId = usePanelId()
 *   return <div>Panel: {panelId}</div>
 * }
 * ```
 */
export function usePanelId(): PanelId {
  return useGeointPanel().panelId
}

/**
 * Get panel atoms from context.
 *
 * Convenience hook for components that only need the atoms.
 *
 * @throws Error if used outside GeointPanelProvider
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const atoms = usePanelAtoms()
 *   const [query, setQuery] = useAtom(atoms.searchQueryAtom)
 *   return <input value={query ?? ''} onChange={e => setQuery(e.target.value)} />
 * }
 * ```
 */
export function usePanelAtoms(): GeointPanelAtoms {
  return useGeointPanel().atoms
}
