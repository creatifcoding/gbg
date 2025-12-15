/**
 * TMNL Commands — Default Commands & Keybindings
 *
 * All built-in commands and their default key bindings.
 * Users can override these via keybindings.json or the settings UI.
 */

import { Effect } from 'effect'
import { defineCommand, defineEntityCommand } from './decorators'
import type { CommandError } from './types'

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
  // Navigation
  goToTopCommand,
  goToBottomCommand,
  goToInboxCommand,
  goToStarredCommand,
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
] as const
