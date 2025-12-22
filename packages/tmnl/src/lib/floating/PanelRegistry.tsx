/**
 * Floating Panel Registry
 *
 * A registry for panel content types that can be dynamically loaded
 * into floating panels. Enables:
 * 1. Opening panels with specific content by ID
 * 2. Creating fresh panels with registered content
 * 3. Dynamic panel content discovery
 *
 * @example
 * ```tsx
 * // Register a panel type
 * panelRegistry.register({
 *   id: 'terminal',
 *   title: 'Terminal',
 *   component: TerminalPanel,
 *   defaultDimensions: { width: 800, height: 500 },
 * })
 *
 * // Open a panel with registered content
 * const { openPanel } = usePanelRegistry()
 * openPanel('terminal')
 *
 * // Or with custom props
 * openPanel('terminal', { shell: '/bin/zsh' })
 * ```
 *
 * @module
 */

import { createContext, useContext, useCallback, type ComponentType, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import {
  registerPanel,
  bringPanelToFront,
  type PanelConfig,
  type Dimensions,
} from './floating-stx'

// ============================================================================
// Types
// ============================================================================

export interface PanelRegistryEntry<P = unknown> {
  /** Unique identifier for this panel type */
  id: string
  /** Display title for panel chrome */
  title: string
  /** Component to render as panel content */
  component: ComponentType<P & { panelId: string }>
  /** Default dimensions when opening */
  defaultDimensions?: Dimensions
  /** Minimum dimensions */
  minDimensions?: Dimensions
  /** Whether panel can be resized */
  resizable?: boolean
  /** Whether panel can be closed */
  closable?: boolean
  /** Whether panel can be minimized */
  minimizable?: boolean
  /** Icon component for panel chrome */
  icon?: ComponentType<{ size?: number }>
}

interface PanelRegistryContextValue {
  /** All registered panel types */
  entries: Map<string, PanelRegistryEntry>
  /** Register a new panel type */
  register: <P>(entry: PanelRegistryEntry<P>) => void
  /** Unregister a panel type */
  unregister: (id: string) => void
  /** Open a panel with registered content */
  openPanel: <P>(typeId: string, props?: P) => string | null
  /** Get a registered entry */
  getEntry: (id: string) => PanelRegistryEntry | undefined
}

// ============================================================================
// Singleton Registry
// ============================================================================

const registryMap = new Map<string, PanelRegistryEntry>()

/**
 * Register a panel type globally.
 * Call this at module initialization time.
 */
export function registerPanelType<P>(entry: PanelRegistryEntry<P>): void {
  registryMap.set(entry.id, entry as PanelRegistryEntry)
}

/**
 * Unregister a panel type.
 */
export function unregisterPanelType(id: string): void {
  registryMap.delete(id)
}

/**
 * Get a registered panel entry.
 */
export function getPanelEntry(id: string): PanelRegistryEntry | undefined {
  return registryMap.get(id)
}

/**
 * Get all registered panel entries.
 */
export function getAllPanelEntries(): PanelRegistryEntry[] {
  return Array.from(registryMap.values())
}

// ============================================================================
// Context
// ============================================================================

const PanelRegistryContext = createContext<PanelRegistryContextValue | null>(null)

export function usePanelRegistry() {
  const ctx = useContext(PanelRegistryContext)
  if (!ctx) {
    // Fallback to singleton if not in provider
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
// Open Panel Function
// ============================================================================

// Track open panels and their props
const openPanelProps = new Map<string, unknown>()

/**
 * Open a floating panel with registered content.
 * Returns the panel ID if successful, null if type not found.
 */
export function openRegisteredPanel<P>(typeId: string, props?: P): string | null {
  const entry = registryMap.get(typeId)
  if (!entry) {
    console.warn(`[PanelRegistry] Panel type not found: ${typeId}`)
    return null
  }

  // Generate unique panel ID
  const panelId = `${typeId}-${nanoid(8)}`

  // Store props for component access
  if (props) {
    openPanelProps.set(panelId, props)
  }

  // Calculate default position (centered-ish)
  const defaultDims = entry.defaultDimensions ?? { width: 600, height: 400 }
  const x = Math.max(50, (window.innerWidth - defaultDims.width) / 2)
  const y = Math.max(50, (window.innerHeight - defaultDims.height) / 2)

  // Register with floating system
  const config: PanelConfig = {
    id: panelId,
    title: entry.title,
    mode: 'floating',
    initialPosition: { x, y },
    initialDimensions: defaultDims,
    constraints: entry.minDimensions
      ? { minWidth: entry.minDimensions.width, minHeight: entry.minDimensions.height }
      : undefined,
    closable: entry.closable ?? true,
    minimizable: entry.minimizable ?? true,
    resizable: entry.resizable ?? true,
    visitorId: typeId,
    visitorData: props,
  }

  registerPanel(config)
  bringPanelToFront(panelId)

  return panelId
}

/**
 * Get the props for an open panel.
 */
export function getPanelProps<P>(panelId: string): P | undefined {
  return openPanelProps.get(panelId) as P | undefined
}

/**
 * Clear props when panel is closed.
 */
export function clearPanelProps(panelId: string): void {
  openPanelProps.delete(panelId)
}

// ============================================================================
// Provider Component
// ============================================================================

interface PanelRegistryProviderProps {
  children: ReactNode
  /** Initial panel entries to register */
  initialEntries?: PanelRegistryEntry[]
}

export function PanelRegistryProvider({
  children,
  initialEntries = [],
}: PanelRegistryProviderProps) {
  // Register initial entries
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

/**
 * Renders the appropriate content for a panel based on its visitorId.
 * Used inside FloatingPanel to dynamically render registered content.
 */
export function PanelContentRenderer({ panelId, visitorId }: PanelContentRendererProps) {
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
}

export default PanelRegistryProvider
