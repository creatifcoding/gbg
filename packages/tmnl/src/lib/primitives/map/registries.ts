/**
 * Map Registries - Atom-based state for registry-backed map primitive
 *
 * Follows Atom-as-State Doctrine:
 * - Atoms ARE the state (no dual-write with useState)
 * - registry.set() for sync mutations in React callbacks
 * - useAtomValue() for subscriptions in components
 * - AI agents can stream updates via generateObject → registry.set()
 *
 * CRITICAL: Uses shared overlayRegistry to ensure mutations propagate to
 * useAtomValue() subscribers. Creating a separate Registry.make() would
 * cause mutations to be invisible to React context readers.
 *
 * @module primitives/map/registries
 */

import { Atom } from '@effect-atom/atom'
import type { ReactNode } from 'react'
import type {
  MapStyleConfig,
  InteractionEvent,
  InteractionHandler,
  WidgetDefinition,
  MapMarker,
  MapViewState,
} from './types'
import type { PickingInfo } from '@deck.gl/core'
import { overlayRegistry } from '@/lib/overlays/atoms'

// =============================================================================
// Shared Registry Reference
// =============================================================================

/**
 * Map primitives share the overlay registry singleton.
 * This prevents context shadowing issues when nested providers exist.
 *
 * CRITICAL: All atoms (map, sidebar, dataplane, overlays) MUST share the same
 * registry to prevent mutations in one registry being invisible to React
 * components reading from another registry via context.
 */
export const mapRegistry = overlayRegistry

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_STYLES: readonly MapStyleConfig[] = [
  { id: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-v9' },
  { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
]

const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 10,
  pitch: 0,
  bearing: 0,
}

// =============================================================================
// Config Registry Atoms
// =============================================================================

/**
 * Available map styles
 */
export const mapStylesAtom = Atom.make<readonly MapStyleConfig[]>(DEFAULT_STYLES)

/**
 * Currently selected style ID
 */
export const activeStyleIdAtom = Atom.make<string>('dark')

/**
 * Derived: Current style config
 */
export const activeStyleAtom = Atom.make((get) => {
  const styles = get(mapStylesAtom)
  const activeId = get(activeStyleIdAtom)
  return styles.find((s) => s.id === activeId) ?? styles[0]
})

// Mount global config atoms to shared registry
// This MUST happen at module load time so ctx.set() and useAtomValue() share state
mapRegistry.mount(mapStylesAtom)
mapRegistry.mount(activeStyleIdAtom)
mapRegistry.mount(activeStyleAtom)

// =============================================================================
// View State Atoms (per-instance via family pattern)
// =============================================================================

/**
 * View state atoms keyed by map instance ID
 */
const viewStateAtoms = new Map<string, Atom.Atom<MapViewState>>()

export function getViewStateAtom(instanceId: string): Atom.Atom<MapViewState> {
  let atom = viewStateAtoms.get(instanceId)
  if (!atom) {
    atom = Atom.make<MapViewState>(DEFAULT_VIEW_STATE)
    viewStateAtoms.set(instanceId, atom)
    mapRegistry.mount(atom) // Mount to shared registry for React context reads
  }
  return atom
}

export function disposeViewStateAtom(instanceId: string): void {
  viewStateAtoms.delete(instanceId)
}

// =============================================================================
// Markers Atoms (per-instance via family pattern)
// =============================================================================

const markersAtoms = new Map<string, Atom.Atom<readonly MapMarker[]>>()

export function getMarkersAtom(instanceId: string): Atom.Atom<readonly MapMarker[]> {
  let atom = markersAtoms.get(instanceId)
  if (!atom) {
    atom = Atom.make<readonly MapMarker[]>([])
    markersAtoms.set(instanceId, atom)
    mapRegistry.mount(atom) // Mount to shared registry for React context reads
  }
  return atom
}

export function disposeMarkersAtom(instanceId: string): void {
  markersAtoms.delete(instanceId)
}

// =============================================================================
// Interaction Registry Atoms
// =============================================================================

/**
 * Interaction handler type with marker context
 */
export type MapInteractionHandler = (info: PickingInfo, marker?: MapMarker) => void

/**
 * Registered interaction handlers
 */
export const interactionHandlersAtom = Atom.make<
  ReadonlyMap<InteractionEvent, MapInteractionHandler>
>(new Map())

// Mount interaction handlers atom to shared registry
mapRegistry.mount(interactionHandlersAtom)

/**
 * Register an interaction handler (sync, use in React callbacks)
 */
export function registerInteraction(
  event: InteractionEvent,
  handler: MapInteractionHandler
): void {
  const current = mapRegistry.get(interactionHandlersAtom)
  const updated = new Map(current)
  updated.set(event, handler)
  mapRegistry.set(interactionHandlersAtom, updated)
}

/**
 * Unregister an interaction handler
 */
export function unregisterInteraction(event: InteractionEvent): void {
  const current = mapRegistry.get(interactionHandlersAtom)
  const updated = new Map(current)
  updated.delete(event)
  mapRegistry.set(interactionHandlersAtom, updated)
}

/**
 * Invoke an interaction handler if registered
 */
export function invokeInteraction(
  event: InteractionEvent,
  info: PickingInfo,
  marker?: MapMarker
): void {
  const handlers = mapRegistry.get(interactionHandlersAtom)
  const handler = handlers.get(event)
  handler?.(info, marker)
}

// =============================================================================
// Widget Registry Atoms
// =============================================================================

/**
 * Registered widgets
 */
export const widgetsAtom = Atom.make<readonly WidgetDefinition[]>([])

/**
 * Register a widget (sync, use in React callbacks)
 */
export function registerWidget(widget: WidgetDefinition): void {
  const current = mapRegistry.get(widgetsAtom)
  // Replace if same ID exists
  const filtered = current.filter((w) => w.id !== widget.id)
  mapRegistry.set(widgetsAtom, [...filtered, widget])
}

/**
 * Unregister a widget
 */
export function unregisterWidget(widgetId: string): void {
  const current = mapRegistry.get(widgetsAtom)
  mapRegistry.set(
    widgetsAtom,
    current.filter((w) => w.id !== widgetId)
  )
}

/**
 * Derived: Widgets grouped by position
 */
export const widgetsByPositionAtom = Atom.make((get) => {
  const widgets = get(widgetsAtom)
  const grouped = new Map<string, WidgetDefinition[]>()

  for (const widget of widgets) {
    const list = grouped.get(widget.position) ?? []
    list.push(widget)
    grouped.set(widget.position, list)
  }

  return grouped
})

// Mount widget atoms to shared registry
mapRegistry.mount(widgetsAtom)
mapRegistry.mount(widgetsByPositionAtom)

// =============================================================================
// Loading/Error/Dimensions State Atoms (per-instance)
// =============================================================================

const loadingAtoms = new Map<string, Atom.Atom<boolean>>()
const errorAtoms = new Map<string, Atom.Atom<string | null>>()
const dimensionsAtoms = new Map<string, Atom.Atom<{ width: number; height: number } | null>>()
const mapLoadedAtoms = new Map<string, Atom.Atom<boolean>>()

export function getLoadingAtom(instanceId: string): Atom.Atom<boolean> {
  let atom = loadingAtoms.get(instanceId)
  if (!atom) {
    atom = Atom.make(true)
    loadingAtoms.set(instanceId, atom)
    mapRegistry.mount(atom) // Mount to shared registry for React context reads
  }
  return atom
}

export function getErrorAtom(instanceId: string): Atom.Atom<string | null> {
  let atom = errorAtoms.get(instanceId)
  if (!atom) {
    atom = Atom.make<string | null>(null)
    errorAtoms.set(instanceId, atom)
    mapRegistry.mount(atom) // Mount to shared registry for React context reads
  }
  return atom
}

export function getDimensionsAtom(
  instanceId: string
): Atom.Atom<{ width: number; height: number } | null> {
  let atom = dimensionsAtoms.get(instanceId)
  if (!atom) {
    atom = Atom.make<{ width: number; height: number } | null>(null)
    dimensionsAtoms.set(instanceId, atom)
    mapRegistry.mount(atom) // Mount to shared registry for React context reads
  }
  return atom
}

export function getMapLoadedAtom(instanceId: string): Atom.Atom<boolean> {
  let atom = mapLoadedAtoms.get(instanceId)
  if (!atom) {
    atom = Atom.make(false)
    mapLoadedAtoms.set(instanceId, atom)
    mapRegistry.mount(atom) // Mount to shared registry for React context reads
  }
  return atom
}

export function disposeInstanceAtoms(instanceId: string): void {
  viewStateAtoms.delete(instanceId)
  markersAtoms.delete(instanceId)
  loadingAtoms.delete(instanceId)
  errorAtoms.delete(instanceId)
  dimensionsAtoms.delete(instanceId)
  mapLoadedAtoms.delete(instanceId)
}

// =============================================================================
// Convenience: Create all atoms for a map instance
// =============================================================================

export interface MapInstanceAtoms {
  viewStateAtom: Atom.Atom<MapViewState>
  markersAtom: Atom.Atom<readonly MapMarker[]>
  loadingAtom: Atom.Atom<boolean>
  errorAtom: Atom.Atom<string | null>
  dimensionsAtom: Atom.Atom<{ width: number; height: number } | null>
  mapLoadedAtom: Atom.Atom<boolean>
}

export function createMapInstanceAtoms(instanceId: string): MapInstanceAtoms {
  return {
    viewStateAtom: getViewStateAtom(instanceId),
    markersAtom: getMarkersAtom(instanceId),
    loadingAtom: getLoadingAtom(instanceId),
    errorAtom: getErrorAtom(instanceId),
    dimensionsAtom: getDimensionsAtom(instanceId),
    mapLoadedAtom: getMapLoadedAtom(instanceId),
  }
}

// =============================================================================
// Traced Map Atoms (Debug Mode)
// =============================================================================

import {
  createTracedAtomGroup,
  defaultDebugSink,
  type TracedAtomGroup,
} from '../atoms/observability'

// Re-export TracedAtomGroup type for consumers
export type { TracedAtomGroup }

/**
 * Create traced map instance atoms for debugging
 *
 * Wraps standard map atoms with observability - all reads/writes emit
 * structured events to testbed logger and DevTools.
 *
 * @example
 * ```tsx
 * // In BaseMap with debug prop
 * const tracedAtoms = useMemo(
 *   () => debug ? createTracedMapAtoms(instanceId) : null,
 *   [instanceId, debug]
 * )
 *
 * // Use traced.set() instead of mapRegistry.set()
 * if (tracedAtoms) {
 *   tracedAtoms.set('dimensionsAtom', { width, height }, 'ResizeObserver')
 * } else {
 *   mapRegistry.set(instanceAtoms.dimensionsAtom, { width, height })
 * }
 * ```
 */
export function createTracedMapAtoms(
  instanceId: string,
  options?: {
    enabled?: boolean
    sampleRate?: number
  }
): TracedAtomGroup<MapInstanceAtoms> {
  const atoms = createMapInstanceAtoms(instanceId)

  return createTracedAtomGroup({
    groupId: `map:${instanceId}`,
    atoms,
    registry: mapRegistry,
    enabled: options?.enabled ?? true,
    sampleRate: options?.sampleRate ?? 1,
    onEvent: defaultDebugSink,
    emitToDevTools: true,
  })
}
