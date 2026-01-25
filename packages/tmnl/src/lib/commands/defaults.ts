/**
 * TMNL Commands — Default Commands & Keybindings
 *
 * All built-in commands and their default key bindings.
 * Users can override these via keybindings.json or the settings UI.
 */

import { Effect } from 'effect'
import { defineCommand, defineEntityCommand, defineBinding } from './decorators'
import { forceLockAtom } from '@/components/splash/services'
import { overlayRegistry } from '@/lib/overlays/atoms'
import { forceScreensaverAtom } from '@/lib/screensaver'

// ─────────────────────────────────────────────────────────────────────────────
// File Commands (global)
// ─────────────────────────────────────────────────────────────────────────────

export const saveCommand = defineCommand(
  {
    id: 'file.save',
    name: 'Save',
    description: 'Save current file',
    category: 'file',
    scope: 'global',
    keys: 'ctrl+s',
  },
  Effect.gen(function* () {
    yield* Effect.log('file.save: Saving...')
    // TODO: Implement actual save logic
  })
)

export const openCommand = defineCommand(
  {
    id: 'file.open',
    name: 'Open File',
    description: 'Open a file',
    category: 'file',
    scope: 'global',
    keys: 'ctrl+o',
  },
  Effect.gen(function* () {
    yield* Effect.log('file.open: Opening file picker...')
    // TODO: Implement file picker
  })
)

export const newFileCommand = defineCommand(
  {
    id: 'file.new',
    name: 'New File',
    description: 'Create a new file',
    category: 'file',
    scope: 'global',
    keys: 'ctrl+n',
  },
  Effect.gen(function* () {
    yield* Effect.log('file.new: Creating new file...')
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// System Commands (global)
// ─────────────────────────────────────────────────────────────────────────────

export const commandPaletteCommand = defineCommand(
  {
    id: 'system.commandPalette',
    name: 'Command Palette',
    description: 'Open M-x style command palette',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+shift+p',
  },
  Effect.gen(function* () {
    // NOTE: This command is a bit recursive — it opens the command palette
    // which allows selecting commands. The command itself doesn't execute
    // anything directly; the executeInteractive flow handles it.
    // For keybind-triggered invocation, this is handled by the hotkey layer
    // calling CommandService.executeInteractive() directly.
    yield* Effect.log('system.commandPalette: Opening via executeInteractive...')
    // The actual palette opening happens via useMinibuffer.executeCommand()
    // which calls CommandService.executeInteractive()
  })
)

// Alt+X binding (Emacs M-x style) for command palette
export const commandPaletteAltBinding = defineBinding(
  'alt+x',
  'system.commandPalette',
  'global'
)

export const settingsCommand = defineCommand(
  {
    id: 'system.settings',
    name: 'Settings',
    description: 'Open settings',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+,',
  },
  Effect.gen(function* () {
    yield* Effect.log('system.settings: Opening...')
  })
)

export const keyboardShortcutsCommand = defineCommand(
  {
    id: 'system.keyboardShortcuts',
    name: 'Keyboard Shortcuts',
    description: 'View and edit keyboard shortcuts',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+k ctrl+s',
  },
  Effect.gen(function* () {
    yield* Effect.log('system.keyboardShortcuts: Opening...')
  })
)

/**
 * Lock Screen Command
 *
 * Triggers the Selfcharters lock screen with ASCII aberration wallpaper.
 * Sets forceLockAtom which LockScreenController watches.
 *
 * Keybinding: Ctrl+Alt+L (avoids conflict with Ctrl+L browser address bar)
 */
export const lockScreenCommand = defineCommand(
  {
    id: 'system.lockScreen',
    name: 'Lock Screen',
    description: 'Lock terminal and show ASCII wallpaper',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+alt+l',
  },
  Effect.gen(function* () {
    yield* Effect.log('system.lockScreen: Locking terminal...')
    // Set the force lock atom — LockScreenController watches this
    // Use overlayRegistry.set() directly (Atom.set returns an Effect, doesn't mutate)
    // overlayRegistry is the global singleton provided to React via OverlayRegistryProvider
    overlayRegistry.set(forceLockAtom, true)
  })
)

/**
 * Screensaver Command
 *
 * Triggers the ASCII art screensaver overlay immediately.
 * Normally activates after idle timeout, but this forces it.
 *
 * Keybinding: Ctrl+Alt+S
 */
export const screensaverCommand = defineCommand(
  {
    id: 'system.screensaver',
    name: 'Screensaver',
    description: 'Activate ASCII art screensaver',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+alt+s',
  },
  Effect.gen(function* () {
    yield* Effect.log('system.screensaver: Activating screensaver...')
    overlayRegistry.set(forceScreensaverAtom, true)
  })
)

/**
 * Toggle Terminal Panel Command
 *
 * Opens/closes the floating terminal panel (VSCode-style).
 * Uses the panel registry to manage terminal instance.
 *
 * Keybinding: Ctrl+` (backtick)
 */
export const toggleTerminalPanelCommand = defineCommand(
  {
    id: 'system.toggleTerminalPanel',
    name: 'Toggle Terminal',
    description: 'Open/close floating terminal panel',
    category: 'system',
    scope: 'global',
    keys: 'ctrl+`',
  },
  Effect.gen(function* () {
    yield* Effect.log('system.toggleTerminalPanel: Toggling terminal panel...')
    // Actual toggle is handled by the onTerminal callback in useGlobalHotkeys
    // This allows the shell to manage panel state via the floating panel system
  })
)

/**
 * Open Testbed Window Command
 *
 * Opens the quick-switcher to select a testbed and open it in a separate
 * Tauri window. If the testbed is already open, focuses the existing window.
 *
 * Keybinding: Ctrl+Shift+N (Cmd+Shift+N on macOS)
 */
export const openTestbedWindowCommand = defineCommand(
  {
    id: 'window.openTestbed',
    name: 'Open Testbed in Window',
    description: 'Open a testbed in a separate window',
    category: 'window',
    scope: 'global',
    keys: 'ctrl+shift+n',
  },
  Effect.gen(function* () {
    yield* Effect.log('window.openTestbed: Opening testbed window picker...')
    // Open minibuffer with TestbedWindowProvider
    minibufferOps.openCommand(TESTBED_WINDOW_PROVIDER_ID, 'Open testbed window: ')
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Commands (global, vim-style sequences)
// ─────────────────────────────────────────────────────────────────────────────

export const goToTopCommand = defineCommand(
  {
    id: 'nav.goToTop',
    name: 'Go to Top',
    description: 'Jump to top of document (vim: gg)',
    category: 'navigation',
    scope: 'global',
    keys: 'g g',
  },
  Effect.gen(function* () {
    yield* Effect.log('nav.goToTop: Jumping to top...')
  })
)

export const goToBottomCommand = defineCommand(
  {
    id: 'nav.goToBottom',
    name: 'Go to Bottom',
    description: 'Jump to bottom of document (vim: G)',
    category: 'navigation',
    scope: 'global',
    keys: 'shift+g',
  },
  Effect.gen(function* () {
    yield* Effect.log('nav.goToBottom: Jumping to bottom...')
  })
)

export const goToInboxCommand = defineCommand(
  {
    id: 'nav.goToInbox',
    name: 'Go to Inbox',
    description: 'Gmail-style inbox navigation',
    category: 'navigation',
    scope: 'global',
    keys: 'g i',
  },
  Effect.gen(function* () {
    yield* Effect.log('nav.goToInbox: Navigating to inbox...')
  })
)

export const goToStarredCommand = defineCommand(
  {
    id: 'nav.goToStarred',
    name: 'Go to Starred',
    description: 'Gmail-style starred navigation',
    category: 'navigation',
    scope: 'global',
    keys: 'g s',
  },
  Effect.gen(function* () {
    yield* Effect.log('nav.goToStarred: Navigating to starred...')
  })
)

export const goToTerminalCommand = defineCommand(
  {
    id: 'nav.goToTerminal',
    name: 'Go to Terminal',
    description: 'Open terminal testbed (ghostty-web)',
    category: 'navigation',
    scope: 'global',
    keys: 'g t',
  },
  Effect.gen(function* () {
    yield* Effect.log('nav.goToTerminal: Navigating to terminal...')
    // Use window.location for navigation (works from any context)
    window.location.href = '/testbed/terminal'
  })
)

export const goToHomeCommand = defineCommand(
  {
    id: 'nav.goToHome',
    name: 'Go to Home',
    description: 'Navigate to home portal',
    category: 'navigation',
    scope: 'global',
    keys: 'g h',
  },
  Effect.gen(function* () {
    yield* Effect.log('nav.goToHome: Navigating to home...')
    window.location.href = '/'
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Editor Commands (editor scope)
// ─────────────────────────────────────────────────────────────────────────────

export const formatDocumentCommand = defineCommand(
  {
    id: 'editor.formatDocument',
    name: 'Format Document',
    description: 'Format the entire document',
    category: 'edit',
    scope: 'editor',
    keys: 'shift+alt+f',
  },
  Effect.gen(function* () {
    yield* Effect.log('editor.formatDocument: Formatting...')
  })
)

export const toggleCommentCommand = defineCommand(
  {
    id: 'editor.toggleComment',
    name: 'Toggle Comment',
    description: 'Toggle line comment',
    category: 'edit',
    scope: 'editor',
    keys: 'ctrl+/',
  },
  Effect.gen(function* () {
    yield* Effect.log('editor.toggleComment: Toggling...')
  })
)

export const undoCommand = defineCommand(
  {
    id: 'editor.undo',
    name: 'Undo',
    description: 'Undo last action',
    category: 'edit',
    scope: 'editor',
    keys: 'ctrl+z',
  },
  Effect.gen(function* () {
    yield* Effect.log('editor.undo: Undoing...')
  })
)

export const redoCommand = defineCommand(
  {
    id: 'editor.redo',
    name: 'Redo',
    description: 'Redo last undone action',
    category: 'edit',
    scope: 'editor',
    keys: 'ctrl+shift+z',
  },
  Effect.gen(function* () {
    yield* Effect.log('editor.redo: Redoing...')
  })
)

export const findCommand = defineCommand(
  {
    id: 'editor.find',
    name: 'Find',
    description: 'Find in document',
    category: 'edit',
    scope: 'editor',
    keys: 'ctrl+f',
  },
  Effect.gen(function* () {
    yield* Effect.log('editor.find: Opening find...')
  })
)

export const replaceCommand = defineCommand(
  {
    id: 'editor.replace',
    name: 'Find and Replace',
    description: 'Find and replace in document',
    category: 'edit',
    scope: 'editor',
    keys: 'ctrl+h',
  },
  Effect.gen(function* () {
    yield* Effect.log('editor.replace: Opening replace...')
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Grid Commands (grid scope, entity-actioned)
// ─────────────────────────────────────────────────────────────────────────────

export interface GridRow {
  id: string
  data: Record<string, unknown>
}

export const gridAddRowCommand = defineCommand(
  {
    id: 'grid.addRow',
    name: 'Add Row',
    description: 'Add a new row below',
    category: 'grid',
    scope: 'grid',
    keys: 'ctrl+enter',
  },
  Effect.gen(function* () {
    yield* Effect.log('grid.addRow: Adding row...')
  })
)

export const gridDeleteRowCommand = defineEntityCommand<GridRow>(
  {
    id: 'grid.deleteRow',
    name: 'Delete Row',
    description: 'Delete selected row',
    category: 'grid',
    scope: 'grid',
    entityType: 'grid.row',
    keys: 'ctrl+backspace',
  },
  (row, _ctx) =>
    Effect.gen(function* () {
      yield* Effect.log(`grid.deleteRow: Deleting row ${row.id}...`)
    })
)

export const gridDuplicateRowCommand = defineEntityCommand<GridRow>(
  {
    id: 'grid.duplicateRow',
    name: 'Duplicate Row',
    description: 'Duplicate selected row',
    category: 'grid',
    scope: 'grid',
    entityType: 'grid.row',
    keys: 'ctrl+d',
  },
  (row, _ctx) =>
    Effect.gen(function* () {
      yield* Effect.log(`grid.duplicateRow: Duplicating row ${row.id}...`)
    })
)

// ─────────────────────────────────────────────────────────────────────────────
// tldraw Commands (tldraw scope)
// ─────────────────────────────────────────────────────────────────────────────

export const tldrawSelectAllCommand = defineCommand(
  {
    id: 'tldraw.selectAll',
    name: 'Select All',
    description: 'Select all shapes',
    category: 'selection',
    scope: 'tldraw',
    keys: 'ctrl+a',
  },
  Effect.gen(function* () {
    yield* Effect.log('tldraw.selectAll: Selecting all...')
  })
)

export const tldrawDeleteCommand = defineCommand(
  {
    id: 'tldraw.delete',
    name: 'Delete Selected',
    description: 'Delete selected shapes',
    category: 'canvas',
    scope: 'tldraw',
    keys: 'delete',
  },
  Effect.gen(function* () {
    yield* Effect.log('tldraw.delete: Deleting selected...')
  })
)

export const tldrawZoomInCommand = defineCommand(
  {
    id: 'tldraw.zoomIn',
    name: 'Zoom In',
    description: 'Zoom in on canvas',
    category: 'view',
    scope: 'tldraw',
    keys: 'ctrl+=',
  },
  Effect.gen(function* () {
    yield* Effect.log('tldraw.zoomIn: Zooming in...')
  })
)

export const tldrawZoomOutCommand = defineCommand(
  {
    id: 'tldraw.zoomOut',
    name: 'Zoom Out',
    description: 'Zoom out on canvas',
    category: 'view',
    scope: 'tldraw',
    keys: 'ctrl+-',
  },
  Effect.gen(function* () {
    yield* Effect.log('tldraw.zoomOut: Zooming out...')
  })
)

export const tldrawZoomFitCommand = defineCommand(
  {
    id: 'tldraw.zoomFit',
    name: 'Zoom to Fit',
    description: 'Fit all shapes in view',
    category: 'view',
    scope: 'tldraw',
    keys: 'ctrl+1',
  },
  Effect.gen(function* () {
    yield* Effect.log('tldraw.zoomFit: Fitting to view...')
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Editor Map Commands (for tool → editor MapBlock insertion)
// ─────────────────────────────────────────────────────────────────────────────

import {
  pendingMapInsertionsAtom,
  updateInsertionStatusTerminal,
} from '@/lib/terminal/v3/atoms/map-insertion'
import { terminalRegistry } from '@/lib/terminal/v3/terminal-stx'
import { TESTBED_WINDOW_PROVIDER_ID } from '@/lib/tauri-windows'
import { ops as minibufferOps } from '@/lib/minibuffer/v2'

/**
 * Editor context for map insertion.
 * Set by EditorProvider when editor is available.
 */
export interface EditorMapContext {
  /** Insert a map block with given data */
  insertMap: (data: {
    markers?: Array<{ position: [number, number]; label?: string; color?: string }>
    layers?: Array<{ id: string; type: string; data: unknown }>
    viewState?: { longitude: number; latitude: number; zoom: number }
  }) => boolean
  /** Focus the editor */
  focus: () => void
  /** Check if editor is available */
  isAvailable: () => boolean
}

// Global editor context reference (set by EditorProvider)
let editorMapContext: EditorMapContext | null = null

/**
 * Set the editor context for map insertion.
 * Called by EditorProvider on mount/unmount.
 */
export function setEditorMapContext(ctx: EditorMapContext | null): void {
  editorMapContext = ctx
}

/**
 * Get the current editor map context.
 */
export function getEditorMapContext(): EditorMapContext | null {
  return editorMapContext
}

/**
 * Insert Map from Tool Result
 *
 * Takes the next pending map insertion and inserts it into the editor.
 * Uses the terminal registry for atom access.
 */
export const insertMapFromToolCommand = defineCommand(
  {
    id: 'editor.insertMapFromTool',
    name: 'Insert Map from Tool',
    description: 'Insert the next pending map from tool results into the editor',
    category: 'edit',
    scope: 'editor',
  },
  Effect.gen(function* () {
    const ctx = getEditorMapContext()
    if (!ctx || !ctx.isAvailable()) {
      yield* Effect.logWarning('editor.insertMapFromTool: Editor not available')
      return
    }

    // Get latest pending from terminal registry
    const insertions = terminalRegistry.get(pendingMapInsertionsAtom)
    const pending = insertions.find((p) => p.status === 'pending')

    if (!pending) {
      yield* Effect.logWarning('editor.insertMapFromTool: No pending map insertions')
      return
    }

    yield* Effect.log(`editor.insertMapFromTool: Inserting map ${pending.id}...`)

    // Mark as inserting
    updateInsertionStatusTerminal(pending.id, 'inserting')

    try {
      ctx.focus()

      const success = ctx.insertMap({
        markers: pending.data.markers?.map((m) => ({
          position: [m.position[0], m.position[1]] as [number, number],
          label: m.label,
          color: m.color,
        })),
        layers: pending.data.layers?.map((l) => ({
          id: l.id,
          type: l.type,
          data: l.data,
        })),
        viewState: pending.data.bounds
          ? {
              longitude: (pending.data.bounds.east + pending.data.bounds.west) / 2,
              latitude: (pending.data.bounds.north + pending.data.bounds.south) / 2,
              zoom: 10,
            }
          : undefined,
      })

      if (success) {
        yield* Effect.log(`editor.insertMapFromTool: Successfully inserted map ${pending.id}`)
        updateInsertionStatusTerminal(pending.id, 'completed')
      } else {
        yield* Effect.logWarning(`editor.insertMapFromTool: Insert failed for ${pending.id}`)
        updateInsertionStatusTerminal(pending.id, 'failed', 'Insert command returned false')
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      yield* Effect.logError(`editor.insertMapFromTool: Error inserting ${pending.id}: ${error}`)
      updateInsertionStatusTerminal(pending.id, 'failed', error)
    }
  })
)

/**
 * Insert Specific Map by ID
 *
 * Inserts a specific pending map by its ID.
 * Used when user clicks "Open in Editor" on a specific tool result.
 */
export const insertMapByIdCommand = defineCommand(
  {
    id: 'editor.insertMapById',
    name: 'Insert Specific Map',
    description: 'Insert a specific pending map by ID',
    category: 'edit',
    scope: 'editor',
  },
  Effect.gen(function* () {
    // Note: This command requires args.mapId to be passed via executeWithArgs
    // For now, it falls back to latest pending
    yield* Effect.log('editor.insertMapById: Use insertMapFromTool for now')
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Export all commands (for side-effect registration)
// ─────────────────────────────────────────────────────────────────────────────

export const allCommands = [
  // File
  saveCommand,
  openCommand,
  newFileCommand,
  // System
  commandPaletteCommand,
  settingsCommand,
  keyboardShortcutsCommand,
  lockScreenCommand,
  screensaverCommand,
  toggleTerminalPanelCommand,
  // Window
  openTestbedWindowCommand,
  // Navigation
  goToTopCommand,
  goToBottomCommand,
  goToInboxCommand,
  goToStarredCommand,
  goToTerminalCommand,
  goToHomeCommand,
  // Editor
  formatDocumentCommand,
  toggleCommentCommand,
  undoCommand,
  redoCommand,
  findCommand,
  replaceCommand,
  // Grid
  gridAddRowCommand,
  gridDeleteRowCommand,
  gridDuplicateRowCommand,
  // tldraw
  tldrawSelectAllCommand,
  tldrawDeleteCommand,
  tldrawZoomInCommand,
  tldrawZoomOutCommand,
  tldrawZoomFitCommand,
  // Map insertion
  insertMapFromToolCommand,
  insertMapByIdCommand,
] as const
