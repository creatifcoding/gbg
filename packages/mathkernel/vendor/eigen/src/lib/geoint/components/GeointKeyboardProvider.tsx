/**
 * GeointKeyboardProvider — Unified Keyboard System for GEOINT
 *
 * Registers GEOINT-specific commands and keybindings using the hotkeys system.
 * Integrates with CommandPalette for M-x style command discovery.
 *
 * Architecture:
 * - Uses hotkeyActions for registry-based command/binding registration
 * - Manages 'geoint' scope lifecycle on mount/unmount
 * - Provides domain-specific hotkeys for map, search, and layer operations
 *
 * @module geoint/components/GeointKeyboardProvider
 */

import { useEffect, useRef, createContext, useContext, type ReactNode } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import {
  hotkeyActions,
  KeyParser,
  type CommandError,
  type KeySequence,
  Scopes,
} from '@/lib/hotkeys'

// ─────────────────────────────────────────────────────────────────────────────
// GEOINT Command Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GEOINT command categories for command palette organization.
 */
export const GEOINT_CATEGORIES = {
  MAP: 'Map',
  SEARCH: 'Search',
  LAYERS: 'Layers',
  SELECTION: 'Selection',
  VIEW: 'View',
  DATA: 'Data',
} as const

/**
 * GEOINT command registry.
 * Each command has an id, name, category, and handler function.
 */
export interface GeointCommand {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly category: (typeof GEOINT_CATEGORIES)[keyof typeof GEOINT_CATEGORIES]
  readonly icon?: string
  readonly handler: () => void | Promise<void>
  readonly when?: () => boolean
}

/**
 * Actions interface for GEOINT keyboard commands.
 * Components provide these through the provider props.
 */
export interface GeointKeyboardActions {
  // Map operations
  zoomIn?: () => void
  zoomOut?: () => void
  resetView?: () => void
  toggleFullscreen?: () => void

  // Search operations
  focusSearch?: () => void
  clearSearch?: () => void
  executeSearch?: () => void
  toggleSearchPanel?: () => void

  // Layer operations
  toggleLayerPanel?: () => void
  toggleLayer?: (layerId: string) => void
  showAllLayers?: () => void
  hideAllLayers?: () => void
  cycleMapStyle?: () => void

  // Selection operations
  selectAll?: () => void
  clearSelection?: () => void
  invertSelection?: () => void
  deleteSelected?: () => void

  // View operations
  fitToSelection?: () => void
  fitToAll?: () => void
}

/**
 * Create GEOINT commands with provided actions.
 */
export function createGeointKeyboardCommands(
  actions: GeointKeyboardActions
): GeointCommand[] {
  const noop = () => console.log('[GEOINT] Action not configured')

  return [
    // ─── Map Commands ─────────────────────────────────────────────────────────
    {
      id: 'geoint.map.zoomIn',
      name: 'Zoom In',
      description: 'Increase map zoom level',
      category: GEOINT_CATEGORIES.MAP,
      icon: 'ZoomIn',
      handler: actions.zoomIn ?? noop,
    },
    {
      id: 'geoint.map.zoomOut',
      name: 'Zoom Out',
      description: 'Decrease map zoom level',
      category: GEOINT_CATEGORIES.MAP,
      icon: 'ZoomOut',
      handler: actions.zoomOut ?? noop,
    },
    {
      id: 'geoint.map.resetView',
      name: 'Reset View',
      description: 'Reset map to default view',
      category: GEOINT_CATEGORIES.MAP,
      icon: 'Home',
      handler: actions.resetView ?? noop,
    },
    {
      id: 'geoint.map.toggleFullscreen',
      name: 'Toggle Fullscreen',
      description: 'Enter or exit fullscreen mode',
      category: GEOINT_CATEGORIES.MAP,
      icon: 'Maximize',
      handler: actions.toggleFullscreen ?? (() => {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen()
      }),
    },

    // ─── Search Commands ──────────────────────────────────────────────────────
    {
      id: 'geoint.search.focus',
      name: 'Focus Search',
      description: 'Focus the search input',
      category: GEOINT_CATEGORIES.SEARCH,
      icon: 'Search',
      handler: actions.focusSearch ?? (() => {
        const input = document.querySelector<HTMLInputElement>('[data-geoint-search-input]')
        input?.focus()
      }),
    },
    {
      id: 'geoint.search.clear',
      name: 'Clear Search',
      description: 'Clear search query and results',
      category: GEOINT_CATEGORIES.SEARCH,
      icon: 'X',
      handler: actions.clearSearch ?? noop,
    },
    {
      id: 'geoint.search.execute',
      name: 'Execute Search',
      description: 'Execute the current search query',
      category: GEOINT_CATEGORIES.SEARCH,
      icon: 'Play',
      handler: actions.executeSearch ?? noop,
    },
    {
      id: 'geoint.search.togglePanel',
      name: 'Toggle Search Panel',
      description: 'Show or hide the search panel',
      category: GEOINT_CATEGORIES.SEARCH,
      icon: 'PanelLeft',
      handler: actions.toggleSearchPanel ?? noop,
    },

    // ─── Layer Commands ───────────────────────────────────────────────────────
    {
      id: 'geoint.layers.togglePanel',
      name: 'Toggle Layer Panel',
      description: 'Show or hide the layer panel',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'Layers',
      handler: actions.toggleLayerPanel ?? noop,
    },
    {
      id: 'geoint.layers.showAll',
      name: 'Show All Layers',
      description: 'Make all layers visible',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'Eye',
      handler: actions.showAllLayers ?? noop,
    },
    {
      id: 'geoint.layers.hideAll',
      name: 'Hide All Layers',
      description: 'Hide all layers',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'EyeOff',
      handler: actions.hideAllLayers ?? noop,
    },
    {
      id: 'geoint.layers.cycleMapStyle',
      name: 'Cycle Map Style',
      description: 'Switch between satellite, terrain, and street views',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'Map',
      handler: actions.cycleMapStyle ?? noop,
    },
    {
      id: 'geoint.layers.toggleOSM',
      name: 'Toggle OpenStreetMap',
      description: 'Show or hide the OSM layer',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'Map',
      handler: () => actions.toggleLayer?.('osm'),
    },
    {
      id: 'geoint.layers.toggleSatellite',
      name: 'Toggle Satellite',
      description: 'Show or hide the satellite layer',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'Globe',
      handler: () => actions.toggleLayer?.('satellite'),
    },
    {
      id: 'geoint.layers.toggleTracks',
      name: 'Toggle Tracks',
      description: 'Show or hide the tracks layer',
      category: GEOINT_CATEGORIES.LAYERS,
      icon: 'Route',
      handler: () => actions.toggleLayer?.('tracks'),
    },

    // ─── Selection Commands ───────────────────────────────────────────────────
    {
      id: 'geoint.selection.all',
      name: 'Select All',
      description: 'Select all visible entities',
      category: GEOINT_CATEGORIES.SELECTION,
      icon: 'CheckSquare',
      handler: actions.selectAll ?? noop,
    },
    {
      id: 'geoint.selection.clear',
      name: 'Clear Selection',
      description: 'Deselect all entities',
      category: GEOINT_CATEGORIES.SELECTION,
      icon: 'Square',
      handler: actions.clearSelection ?? noop,
    },
    {
      id: 'geoint.selection.invert',
      name: 'Invert Selection',
      description: 'Invert the current selection',
      category: GEOINT_CATEGORIES.SELECTION,
      icon: 'FlipVertical',
      handler: actions.invertSelection ?? noop,
    },
    {
      id: 'geoint.selection.delete',
      name: 'Delete Selected',
      description: 'Delete the selected entities',
      category: GEOINT_CATEGORIES.SELECTION,
      icon: 'Trash2',
      handler: actions.deleteSelected ?? noop,
    },

    // ─── View Commands ────────────────────────────────────────────────────────
    {
      id: 'geoint.view.fitToSelection',
      name: 'Fit to Selection',
      description: 'Zoom map to fit selected entities',
      category: GEOINT_CATEGORIES.VIEW,
      icon: 'Maximize2',
      handler: actions.fitToSelection ?? noop,
    },
    {
      id: 'geoint.view.fitToAll',
      name: 'Fit to All',
      description: 'Zoom map to fit all entities',
      category: GEOINT_CATEGORIES.VIEW,
      icon: 'Scan',
      handler: actions.fitToAll ?? noop,
    },
  ]
}

/**
 * Default GEOINT keybindings.
 * Maps key sequences to command IDs.
 */
export const GEOINT_BINDINGS: Array<{
  keys: string
  commandId: string
  description?: string
}> = [
  // Map navigation
  { keys: '=', commandId: 'geoint.map.zoomIn', description: 'Zoom in' },
  { keys: '-', commandId: 'geoint.map.zoomOut', description: 'Zoom out' },
  { keys: '0', commandId: 'geoint.map.resetView', description: 'Reset view' },
  { keys: 'f', commandId: 'geoint.map.toggleFullscreen', description: 'Fullscreen' },

  // Search
  { keys: '/', commandId: 'geoint.search.focus', description: 'Focus search' },
  { keys: 'ctrl+/', commandId: 'geoint.search.togglePanel', description: 'Toggle search' },
  { keys: 'escape', commandId: 'geoint.search.clear', description: 'Clear search' },

  // Layers (g prefix for "goto/toggle")
  { keys: 'g l', commandId: 'geoint.layers.togglePanel', description: 'Layers panel' },
  { keys: 'g m', commandId: 'geoint.layers.cycleMapStyle', description: 'Cycle map style' },
  { keys: 'g 1', commandId: 'geoint.layers.toggleOSM', description: 'Toggle OSM' },
  { keys: 'g 2', commandId: 'geoint.layers.toggleSatellite', description: 'Toggle satellite' },
  { keys: 'g 3', commandId: 'geoint.layers.toggleTracks', description: 'Toggle tracks' },
  { keys: 'shift+h', commandId: 'geoint.layers.hideAll', description: 'Hide all layers' },
  { keys: 'shift+s', commandId: 'geoint.layers.showAll', description: 'Show all layers' },

  // Selection
  { keys: 'ctrl+a', commandId: 'geoint.selection.all', description: 'Select all' },
  { keys: 'ctrl+shift+a', commandId: 'geoint.selection.clear', description: 'Clear selection' },
  { keys: 'ctrl+i', commandId: 'geoint.selection.invert', description: 'Invert selection' },
  { keys: 'delete', commandId: 'geoint.selection.delete', description: 'Delete selected' },
  { keys: 'backspace', commandId: 'geoint.selection.delete', description: 'Delete selected' },

  // View
  { keys: 'z f', commandId: 'geoint.view.fitToSelection', description: 'Fit to selection' },
  { keys: 'z a', commandId: 'geoint.view.fitToAll', description: 'Fit to all' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Key Parsing Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a key string using the KeyParser service.
 * Returns a Promise that resolves to the parsed KeySequence.
 */
async function parseKeyString(keys: string): Promise<KeySequence> {
  const program = Effect.gen(function* () {
    const parser = yield* KeyParser
    return yield* parser.parse(keys)
  }).pipe(Effect.provide(KeyParser.Default))

  return Effect.runPromise(program)
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface GeointKeyboardContextValue {
  readonly commands: ReadonlyMap<string, GeointCommand>
  readonly executeCommand: (commandId: string) => void
}

const GeointKeyboardContext = createContext<GeointKeyboardContextValue | null>(null)

/**
 * Access GEOINT keyboard commands.
 */
export function useGeointKeyboard(): GeointKeyboardContextValue {
  const ctx = useContext(GeointKeyboardContext)
  if (!ctx) {
    throw new Error('useGeointKeyboard must be used within GeointKeyboardProvider')
  }
  return ctx
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Component
// ─────────────────────────────────────────────────────────────────────────────

export interface GeointKeyboardProviderProps {
  readonly children: ReactNode
  /** Actions for keyboard commands */
  readonly actions?: GeointKeyboardActions
  /** Custom commands to register alongside defaults */
  readonly customCommands?: GeointCommand[]
  /** Whether to activate the geoint scope on mount */
  readonly activateScope?: boolean
}

/**
 * GeointKeyboardProvider — Registers GEOINT commands and bindings.
 *
 * Usage:
 * ```tsx
 * <GeointKeyboardProvider
 *   actions={{
 *     zoomIn: () => mapRef.current?.zoomIn(),
 *     zoomOut: () => mapRef.current?.zoomOut(),
 *     toggleSearchPanel: () => togglePanel('search'),
 *     clearSelection: () => clearSelection(),
 *   }}
 * >
 *   <GeointDashboard />
 * </GeointKeyboardProvider>
 * ```
 */
export function GeointKeyboardProvider({
  children,
  actions = {},
  customCommands = [],
  activateScope = true,
}: GeointKeyboardProviderProps) {
  const registry = useContext(RegistryContext)
  const commandsRef = useRef<Map<string, GeointCommand>>(new Map())
  const registeredRef = useRef(false)

  // Register commands and bindings on mount
  useEffect(() => {
    if (registeredRef.current || !registry) return
    registeredRef.current = true

    // Create default commands with provided actions
    const defaultCommands = createGeointKeyboardCommands(actions)

    // Merge with custom commands
    const allCommands = [...defaultCommands, ...customCommands]

    // Store in ref for context value
    for (const cmd of allCommands) {
      commandsRef.current.set(cmd.id, cmd)
    }

    // Register commands in hotkey system
    for (const cmd of allCommands) {
      const handler = Effect.sync(() => {
        cmd.handler()
      })

      hotkeyActions.registerCommand(
        registry,
        {
          id: cmd.id,
          name: cmd.name,
          description: cmd.description,
          category: cmd.category,
          icon: cmd.icon,
          when: cmd.when ? () => cmd.when!() : undefined,
        },
        handler as Effect.Effect<void, CommandError, never>
      )
    }

    // Register bindings asynchronously (need to parse key strings)
    const registerBindings = async () => {
      for (const binding of GEOINT_BINDINGS) {
        try {
          // Parse keys using KeyParser service
          const sequence = await parseKeyString(binding.keys)

          // Add binding to registry
          hotkeyActions.addBinding(registry, {
            keys: sequence,
            commandId: binding.commandId,
            scope: Scopes.GEOINT,
            priority: 10,
            source: 'default',
            description: binding.description,
          })
        } catch (e) {
          console.warn(`[GEOINT] Failed to parse keys "${binding.keys}":`, e)
        }
      }
    }

    registerBindings()

    // Activate geoint scope
    if (activateScope) {
      hotkeyActions.pushScope(registry, Scopes.GEOINT)
    }

    // Cleanup on unmount
    return () => {
      if (activateScope && registry) {
        hotkeyActions.popScope(registry)
      }
      registeredRef.current = false
    }
  }, [registry, activateScope, actions, customCommands])

  // Execute command helper
  const executeCommand = (commandId: string) => {
    const cmd = commandsRef.current.get(commandId)
    if (cmd) {
      cmd.handler()
    } else {
      console.warn(`[GEOINT] Unknown command: ${commandId}`)
    }
  }

  const contextValue: GeointKeyboardContextValue = {
    commands: commandsRef.current,
    executeCommand,
  }

  return (
    <GeointKeyboardContext.Provider value={contextValue}>
      {children}
    </GeointKeyboardContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { Scopes } from '@/lib/hotkeys'
