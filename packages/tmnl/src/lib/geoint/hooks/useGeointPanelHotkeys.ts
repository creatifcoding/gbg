/**
 * GEOINT Panel-Scoped Hotkey Hook
 *
 * Encapsulated hook that manages panel-specific hotkey registration and scope activation.
 * Opaque abstraction - hides all complexity from consumers.
 *
 * Architecture:
 * - Registers unique runtime scope per panel: `geoint:${slug}:${uuid}`
 * - Focus/blur events push/pop scope from stack
 * - Only focused panel captures keyboard events
 * - Automatic cleanup on unmount
 *
 * @module geoint/hooks/useGeointPanelHotkeys
 */

import { useEffect, useRef, useContext } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { hotkeyActions, KeyParser, type CommandError } from '@/lib/hotkeys'
import type { PanelIdentity } from '../atoms/families'
import { panelIdentityToScopeId } from '../atoms/families'
import type { SearchOperations } from '../atoms/searchOperations'
import type { MapController } from '../map/MapController'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Hook return value.
 * Provides ref to attach to panel container element.
 */
export interface UseGeointPanelHotkeysReturn {
  /**
   * Ref to attach to panel container DOM element.
   * Handles focus/blur events for scope management.
   *
   * Example: <div ref={containerRef} tabIndex={-1}>...</div>
   */
  readonly containerRef: React.RefObject<HTMLDivElement>
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Manage panel-scoped hotkeys with automatic scope activation.
 *
 * Registers commands and bindings for the panel's unique scope.
 * Activates scope when panel gains focus, deactivates on blur.
 *
 * @param identity - Panel identity (UUID + slug)
 * @param operations - Unified operations object (legacy — search ops only)
 * @param mapController - MapController for unified map/view/layer/selection ops
 * @returns Container ref to attach to DOM element
 *
 * @example
 * ```tsx
 * function GeointDashboardPanel({ identity }: { identity: PanelIdentity }) {
 *   const panelId = panelIdentityToId(identity)
 *   const searchOps = createSearchOperations(panelId)
 *   const controller = useMapController()
 *   const { containerRef } = useGeointPanelHotkeys(identity, searchOps, controller)
 *
 *   return (
 *     <div ref={containerRef} tabIndex={-1} className="geoint-panel">
 *       {/* Panel content *\/}
 *     </div>
 *   )
 * }
 * ```
 */
export function useGeointPanelHotkeys(
  identity: PanelIdentity,
  operations: SearchOperations,
  mapController: MapController
): UseGeointPanelHotkeysReturn {
  const registry = useContext(RegistryContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const scopeId = panelIdentityToScopeId(identity)
  const registeredRef = useRef(false)

  // Register commands and bindings on mount
  useEffect(() => {
    if (registeredRef.current || !registry) return
    registeredRef.current = true

    // TODO: Register runtime scope via ScopeRegistry
    // This requires Effect-based registration which we'll implement later

    // Register commands with panel-specific scope
    registerCommands(registry, scopeId, operations, mapController)

    // Register bindings asynchronously (need to parse key strings)
    registerBindings(registry, scopeId).catch((e) => {
      console.error(`[useGeointPanelHotkeys] Failed to register bindings for ${scopeId}:`, e)
    })

    console.log(`[useGeointPanelHotkeys] Registered commands for ${scopeId}`)
  }, [identity, operations, registry, scopeId, mapController])

  // Handle focus/blur for scope activation
  useEffect(() => {
    const element = containerRef.current
    if (!element || !registry) return

    const handleFocus = () => {
      console.log(`[useGeointPanelHotkeys] Activating scope: ${scopeId}`)
      hotkeyActions.pushScope(registry, scopeId as any) // Cast to ScopeId
    }

    const handleBlur = () => {
      console.log(`[useGeointPanelHotkeys] Deactivating scope: ${scopeId}`)
      hotkeyActions.popScope(registry)
    }

    // Use focusin/focusout for bubbling behavior
    element.addEventListener('focusin', handleFocus)
    element.addEventListener('focusout', handleBlur)

    return () => {
      element.removeEventListener('focusin', handleFocus)
      element.removeEventListener('focusout', handleBlur)
    }
  }, [registry, scopeId])

  return { containerRef }
}

// =============================================================================
// COMMAND REGISTRATION
// =============================================================================

/**
 * Register all GEOINT commands for a panel.
 */
function registerCommands(
  registry: any,
  scopeId: string,
  ops: SearchOperations,
  mapController: MapController
): void {
  const commands = createPanelCommands(ops, mapController)

  for (const cmd of commands) {
    const handler = Effect.sync(() => {
      cmd.handler()
    })

    hotkeyActions.registerCommand(
      registry,
      {
        id: `${scopeId}.${cmd.id}`,
        name: cmd.name,
        description: cmd.description,
        category: cmd.category,
      },
      handler as Effect.Effect<void, CommandError, never>
    )
  }
}

/**
 * Register all GEOINT keybindings for a panel.
 */
async function registerBindings(registry: any, scopeId: string): Promise<void> {
  const bindings = getPanelBindings()

  for (const binding of bindings) {
    try {
      const sequence = await parseKeyString(binding.keys)

      hotkeyActions.addBinding(registry, {
        keys: sequence,
        commandId: `${scopeId}.${binding.commandId}`,
        scope: scopeId as any, // Cast to ScopeId
        priority: 15, // GEOINT scope priority
        source: 'default',
        description: binding.description,
      })
    } catch (e) {
      console.warn(`[useGeointPanelHotkeys] Failed to parse keys "${binding.keys}":`, e)
    }
  }
}

/**
 * Parse a key string using the KeyParser service.
 */
async function parseKeyString(keys: string): Promise<any> {
  const program = Effect.gen(function* () {
    const parser = yield* KeyParser
    return yield* parser.parse(keys)
  }).pipe(Effect.provide(KeyParser.Default))

  return Effect.runPromise(program)
}

// =============================================================================
// COMMAND DEFINITIONS
// =============================================================================

interface PanelCommand {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly category: string
  readonly handler: () => void
}

function createPanelCommands(ops: SearchOperations, mc: MapController): PanelCommand[] {
  return [
    // Map operations — MapController only
    { id: 'map.zoomIn', name: 'Zoom In', category: 'Map', handler: () => mc.zoomIn() },
    { id: 'map.zoomOut', name: 'Zoom Out', category: 'Map', handler: () => mc.zoomOut() },
    { id: 'map.resetView', name: 'Reset View', category: 'Map', handler: () => mc.resetView() },

    // Search operations — still on legacy ops (MapController does not absorb search)
    { id: 'search.focus', name: 'Focus Search', category: 'Search', handler: () => ops.focusSearch() },
    { id: 'search.clear', name: 'Clear Search', category: 'Search', handler: () => ops.clearSearch() },
    { id: 'search.execute', name: 'Execute Search', category: 'Search', handler: () => ops.executeSearch() },
    { id: 'search.togglePanel', name: 'Toggle Search Panel', category: 'Search', handler: () => ops.toggleSearchPanel() },

    // Layer operations — MapController only
    { id: 'layers.togglePanel', name: 'Toggle Layers Panel', category: 'Layers', handler: () => mc.toggleLayerPanel() },
    { id: 'layers.showAll', name: 'Show All Layers', category: 'Layers', handler: () => mc.showAllLayers() },
    { id: 'layers.hideAll', name: 'Hide All Layers', category: 'Layers', handler: () => mc.hideAllLayers() },
    { id: 'layers.cycleMapStyle', name: 'Cycle Map Style', category: 'Layers', handler: () => mc.cycleMapStyle() },
    { id: 'layers.toggleTracks', name: 'Toggle Tracks Layer', category: 'Layers', handler: () => mc.toggleLayer('tracks') },
    { id: 'layers.togglePois', name: 'Toggle POIs Layer', category: 'Layers', handler: () => mc.toggleLayer('pois') },
    { id: 'layers.toggleFlights', name: 'Toggle Flights Layer', category: 'Layers', handler: () => mc.toggleLayer('flights') },

    // Selection operations — MapController only
    { id: 'selection.all', name: 'Select All', category: 'Selection', handler: () => mc.selectAll() },
    { id: 'selection.clear', name: 'Clear Selection', category: 'Selection', handler: () => mc.clearSelection() },
    { id: 'selection.invert', name: 'Invert Selection', category: 'Selection', handler: () => mc.invertSelection() },
    { id: 'selection.delete', name: 'Delete Selected', category: 'Selection', handler: () => mc.deleteSelected() },

    // View operations — MapController only
    { id: 'view.fitToSelection', name: 'Fit to Selection', category: 'View', handler: () => mc.fitToSelection() },
    { id: 'view.fitToAll', name: 'Fit to All', category: 'View', handler: () => mc.fitToAll() },

    // MapController-exclusive commands
    { id: 'map.setHome', name: 'Set Home Position', category: 'Map', handler: () => mc.setHome() },
    { id: 'map.cancelAnimation', name: 'Cancel Camera Animation', category: 'Map', handler: () => mc.cancelAnimation() },
    {
      id: 'map.exportGeoJSON',
      name: 'Export as GeoJSON',
      category: 'Export',
      handler: () => {
        const geojson = mc.toGeoJSON()
        console.log('[GEOINT] GeoJSON export:', geojson.features.length, 'features')
        navigator.clipboard?.writeText(JSON.stringify(geojson, null, 2)).catch(() => {})
      },
    },
  ]
}

// =============================================================================
// BINDING DEFINITIONS
// =============================================================================

interface PanelBinding {
  readonly keys: string
  readonly commandId: string
  readonly description?: string
}

function getPanelBindings(): PanelBinding[] {
  const bindings: PanelBinding[] = [
    // Map navigation
    { keys: '=', commandId: 'map.zoomIn', description: 'Zoom in' },
    { keys: '-', commandId: 'map.zoomOut', description: 'Zoom out' },
    { keys: '0', commandId: 'map.resetView', description: 'Reset view' },

    // Search
    { keys: '/', commandId: 'search.focus', description: 'Focus search' },
    { keys: 'ctrl+/', commandId: 'search.togglePanel', description: 'Toggle search panel' },
    { keys: 'escape', commandId: 'search.clear', description: 'Clear search' },
    { keys: 'enter', commandId: 'search.execute', description: 'Execute search' },

    // Layers
    { keys: 'g l', commandId: 'layers.togglePanel', description: 'Toggle layers panel' },
    { keys: 'g m', commandId: 'layers.cycleMapStyle', description: 'Cycle map style' },
    { keys: 'g t', commandId: 'layers.toggleTracks', description: 'Toggle tracks' },
    { keys: 'g p', commandId: 'layers.togglePois', description: 'Toggle POIs' },
    { keys: 'g f', commandId: 'layers.toggleFlights', description: 'Toggle flights' },
    { keys: 'shift+h', commandId: 'layers.hideAll', description: 'Hide all layers' },
    { keys: 'shift+s', commandId: 'layers.showAll', description: 'Show all layers' },

    // Selection
    { keys: 'ctrl+a', commandId: 'selection.all', description: 'Select all' },
    { keys: 'ctrl+shift+a', commandId: 'selection.clear', description: 'Clear selection' },
    { keys: 'ctrl+i', commandId: 'selection.invert', description: 'Invert selection' },
    { keys: 'delete', commandId: 'selection.delete', description: 'Delete selected' },
    { keys: 'backspace', commandId: 'selection.delete', description: 'Delete selected' },

    // View
    { keys: 'z f', commandId: 'view.fitToSelection', description: 'Fit to selection' },
    { keys: 'z a', commandId: 'view.fitToAll', description: 'Fit to all' },
  ]

  // MapController-exclusive bindings
  bindings.push(
    { keys: 'ctrl+h', commandId: 'map.setHome', description: 'Set home position' },
    { keys: 'ctrl+e', commandId: 'map.exportGeoJSON', description: 'Export GeoJSON to clipboard' },
  )

  return bindings
}
