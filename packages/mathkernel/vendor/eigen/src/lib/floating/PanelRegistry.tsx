/**
 * Floating Panel Registry — types, context, provider, renderer.
 *
 * CRUD operations in panel-registry-crud.ts
 * Open/spawn operations in panel-registry-open.ts
 *
 * @module floating/PanelRegistry
 */

import { createContext, useContext, memo, type ComponentType, type ReactNode } from 'react'
import type { Dimensions } from './floating-stx'
import {
  registryMap,
  registerPanelType,
  unregisterPanelType,
  getPanelEntry,
  getPanelProps,
} from './panel-registry-crud'
import { openRegisteredPanel } from './panel-registry-open'

// Re-export everything for backward compat
export {
  registerPanelType,
  unregisterPanelType,
  getPanelEntry,
  getAllPanelEntries,
  getPanelProps,
  clearPanelProps,
} from './panel-registry-crud'
export { openRegisteredPanel } from './panel-registry-open'

// ============================================================================
// Types
// ============================================================================

export interface PanelRegistryEntry<P = unknown> {
  id: string
  title: string
  component: ComponentType<P & { panelId: string }>
  defaultDimensions?: Dimensions
  minDimensions?: Dimensions
  resizable?: boolean
  closable?: boolean
  minimizable?: boolean
  icon?: ComponentType<{ size?: number }>
}

interface PanelRegistryContextValue {
  entries: Map<string, PanelRegistryEntry>
  register: <P>(entry: PanelRegistryEntry<P>) => void
  unregister: (id: string) => void
  openPanel: <P>(typeId: string, props?: P) => string | null
  getEntry: (id: string) => PanelRegistryEntry | undefined
}

// ============================================================================
// Context
// ============================================================================

const PanelRegistryContext = createContext<PanelRegistryContextValue | null>(null)

export function usePanelRegistry() {
  const ctx = useContext(PanelRegistryContext)
  if (!ctx) {
    return {
      entries: registryMap,
      register: registerPanelType,
      unregister: unregisterPanelType,
      getEntry: getPanelEntry,
      openPanel: openRegisteredPanel,
    }
  }
  return ctx
}

// ============================================================================
// Provider
// ============================================================================

interface PanelRegistryProviderProps {
  children: ReactNode
  initialEntries?: PanelRegistryEntry[]
}

export function PanelRegistryProvider({
  children,
  initialEntries = [],
}: PanelRegistryProviderProps) {
  initialEntries.forEach((entry) => registryMap.set(entry.id, entry))

  const value: PanelRegistryContextValue = {
    entries: registryMap,
    register: registerPanelType,
    unregister: unregisterPanelType,
    openPanel: openRegisteredPanel,
    getEntry: getPanelEntry,
  }

  return (
    <PanelRegistryContext.Provider value={value}>
      {children}
    </PanelRegistryContext.Provider>
  )
}

// ============================================================================
// Panel Content Renderer
// ============================================================================

interface PanelContentRendererProps {
  panelId: string
  visitorId?: string
}

export const PanelContentRenderer = memo(function PanelContentRenderer({ panelId, visitorId }: PanelContentRendererProps) {
  if (!visitorId) return null

  const entry = registryMap.get(visitorId)
  if (!entry) {
    return (
      <div style={{ padding: '20px', color: '#ff5555', fontFamily: 'monospace' }}>
        Panel type not found: {visitorId}
      </div>
    )
  }

  const Component = entry.component
  const props = getPanelProps(panelId)

  return <Component panelId={panelId} {...(props as object)} />
})

export default PanelRegistryProvider
