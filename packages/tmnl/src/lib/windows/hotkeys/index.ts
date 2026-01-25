/**
 * Window Hotkeys - Emacs-Style Keybindings
 *
 * Registers C-x prefix bindings for window management:
 * - C-x 2: Split horizontal (below)
 * - C-x 3: Split vertical (right)
 * - C-x o: Other window (next pane)
 * - C-x O: Previous window
 * - C-x 0: Delete window (close pane)
 * - C-x 1: Delete other windows
 *
 * @module lib/windows/hotkeys
 */

import { Effect } from 'effect'
import type { Binding, KeySequence, Command, CommandError } from '@/lib/hotkeys'
import { hotkeyActions, hotkeyOps } from '@/lib/hotkeys'
import { overlayRegistry } from '@/lib/overlays'
import { windowActions } from '../atoms'

// =============================================================================
// Command Definitions
// =============================================================================

const WINDOW_COMMANDS = {
  splitBelow: {
    id: 'window.split-below',
    name: 'Split Below',
    description: 'Split window horizontally (C-x 2)',
    category: 'Window',
  },
  splitRight: {
    id: 'window.split-right',
    name: 'Split Right',
    description: 'Split window vertically (C-x 3)',
    category: 'Window',
  },
  nextWindow: {
    id: 'window.next',
    name: 'Other Window',
    description: 'Switch to next window (C-x o)',
    category: 'Window',
  },
  prevWindow: {
    id: 'window.prev',
    name: 'Previous Window',
    description: 'Switch to previous window (C-x O)',
    category: 'Window',
  },
  closeWindow: {
    id: 'window.close',
    name: 'Delete Window',
    description: 'Close current window (C-x 0)',
    category: 'Window',
  },
  closeOthers: {
    id: 'window.close-others',
    name: 'Delete Other Windows',
    description: 'Close all windows except current (C-x 1)',
    category: 'Window',
  },
} as const

// =============================================================================
// Command Handlers
// =============================================================================

const handlers = {
  splitBelow: Effect.sync(() => {
    windowActions.splitHorizontal()
  }),

  splitRight: Effect.sync(() => {
    windowActions.splitVertical()
  }),

  nextWindow: Effect.sync(() => {
    windowActions.nextPane()
  }),

  prevWindow: Effect.sync(() => {
    windowActions.prevPane()
  }),

  closeWindow: Effect.sync(() => {
    windowActions.closePane()
  }),

  closeOthers: Effect.sync(() => {
    windowActions.closeOtherPanes()
  }),
}

// =============================================================================
// Binding Definitions
// =============================================================================

/**
 * Create key sequence manually (since we can't use async KeyParser here).
 * C-x prefix + key.
 */
function ctrlXSequence(key: string, shift = false): KeySequence {
  return [
    { ctrl: true, alt: false, shift: false, meta: false, key: 'x' },
    { ctrl: false, alt: false, shift, meta: false, key },
  ]
}

const WINDOW_BINDINGS: Array<{ keys: KeySequence; commandId: string }> = [
  { keys: ctrlXSequence('2'), commandId: WINDOW_COMMANDS.splitBelow.id },
  { keys: ctrlXSequence('3'), commandId: WINDOW_COMMANDS.splitRight.id },
  { keys: ctrlXSequence('o'), commandId: WINDOW_COMMANDS.nextWindow.id },
  { keys: ctrlXSequence('O', true), commandId: WINDOW_COMMANDS.prevWindow.id },
  { keys: ctrlXSequence('0'), commandId: WINDOW_COMMANDS.closeWindow.id },
  { keys: ctrlXSequence('1'), commandId: WINDOW_COMMANDS.closeOthers.id },
]

// =============================================================================
// Registration
// =============================================================================

let registered = false

/**
 * Register window management commands and hotkeys.
 * Call this once during app initialization.
 */
export function registerWindowHotkeys() {
  if (registered) return
  registered = true

  // Register commands
  hotkeyActions.registerCommand(
    overlayRegistry,
    WINDOW_COMMANDS.splitBelow,
    handlers.splitBelow as Effect.Effect<void, CommandError, never>
  )
  hotkeyActions.registerCommand(
    overlayRegistry,
    WINDOW_COMMANDS.splitRight,
    handlers.splitRight as Effect.Effect<void, CommandError, never>
  )
  hotkeyActions.registerCommand(
    overlayRegistry,
    WINDOW_COMMANDS.nextWindow,
    handlers.nextWindow as Effect.Effect<void, CommandError, never>
  )
  hotkeyActions.registerCommand(
    overlayRegistry,
    WINDOW_COMMANDS.prevWindow,
    handlers.prevWindow as Effect.Effect<void, CommandError, never>
  )
  hotkeyActions.registerCommand(
    overlayRegistry,
    WINDOW_COMMANDS.closeWindow,
    handlers.closeWindow as Effect.Effect<void, CommandError, never>
  )
  hotkeyActions.registerCommand(
    overlayRegistry,
    WINDOW_COMMANDS.closeOthers,
    handlers.closeOthers as Effect.Effect<void, CommandError, never>
  )

  // Register bindings
  for (const { keys, commandId } of WINDOW_BINDINGS) {
    const binding: Binding = {
      keys,
      commandId,
      scope: 'global',
      priority: 0,
      source: 'default',
    }
    hotkeyActions.addBinding(overlayRegistry, binding)
  }

  console.log('[windows] Registered Emacs-style window hotkeys')
}

/**
 * Unregister window hotkeys (for testing/cleanup).
 */
export function unregisterWindowHotkeys() {
  if (!registered) return

  for (const { keys, commandId } of WINDOW_BINDINGS) {
    hotkeyActions.removeBinding(overlayRegistry, keys, 'global')
  }

  registered = false
}

export { WINDOW_COMMANDS, WINDOW_BINDINGS }
