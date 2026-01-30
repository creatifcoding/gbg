/**
 * useGlobalHotkeys Hook
 *
 * Production-ready global hotkey listener for the TMNL shell.
 * Combines command wiring with keyboard event processing.
 *
 * Features:
 * - Auto-wires all system commands on mount
 * - Global keydown listener via window.addEventListener
 * - Processes events through hotkey system atoms
 * - Special handling for system.commandPalette → minibuffer
 * - Sequence timeout handling for multi-chord shortcuts
 * - Exposes which-key entries for popup display
 *
 * @module
 */

import { useContext, useEffect, useRef, useCallback, useState } from "react"
import { RegistryContext } from "@effect-atom/atom-react"
import { useAtomValue } from "@effect-atom/atom-react"
import { Effect } from "effect"
import { useMinibuffer } from "@/lib/minibuffer"
import { useCommandWire } from "@/lib/commands"
import { TESTBED_WINDOW_PROVIDER_ID } from "@/lib/tauri-windows"
import {
  sequenceSourceAtom,
  scopedBindingsAtom,
  commandsSourceAtom,
  whichKeyEntriesAtom,
  hotkeyActions,
  processKeyboardEvent,
} from "../atoms"
import type { KeyChord, KeySequence, WhichKeyEntry } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Sequence timeout in ms */
const SEQUENCE_TIMEOUT = 1000

/** Delay before showing which-key popup (ms) */
const WHICH_KEY_DELAY = 500

/** Command IDs with special handling */
const SPECIAL_COMMANDS = {
  COMMAND_PALETTE: "system.commandPalette",
  SETTINGS: "system.settings",
  TERMINAL_PANEL: "system.toggleTerminalPanel",
  MINIBUFFER_CANCEL: "minibuffer.cancel",
  OPEN_TESTBED_WINDOW: "window.openTestbed",
} as const

/**
 * Browser shortcuts to block unconditionally.
 *
 * These shortcuts conflict with app functionality and must be intercepted
 * before the browser handles them. Based on VS Code's approach.
 *
 * Format: "modifier+key" where modifiers are ctrl, alt, shift, meta
 * Multiple modifiers: "ctrl+shift+p"
 */
const BROWSER_SHORTCUTS_TO_BLOCK = new Set([
  // M-x / Emacs-style
  "alt+x",           // Menu bar access on Windows/Linux

  // Terminal panel toggle
  "ctrl+`",          // VSCode-style terminal toggle

  // Common browser shortcuts we want to intercept
  "ctrl+k",          // Browser URL bar focus / kill line
  "ctrl+l",          // Address bar focus
  "ctrl+shift+p",    // Private browsing (we use for command palette)
  "ctrl+shift+i",    // DevTools (allow our debug commands)
  "ctrl+shift+j",    // DevTools console

  // Save/Open dialogs
  "ctrl+s",          // Browser save page
  "ctrl+o",          // Browser open file
  "ctrl+p",          // Browser print

  // Tab/Window management (intercept for app use)
  "ctrl+n",          // New window
  "ctrl+shift+n",    // New incognito / our testbed window picker
  "ctrl+t",          // New tab
  "ctrl+w",          // Close tab
  "ctrl+shift+t",    // Reopen tab

  // Navigation
  "alt+left",        // Browser back
  "alt+right",       // Browser forward

  // Find
  "ctrl+f",          // Browser find
  "ctrl+g",          // Find next
  "ctrl+shift+g",    // Find previous

  // Zoom (let app handle)
  "ctrl+=",          // Zoom in
  "ctrl+-",          // Zoom out
  "ctrl+0",          // Reset zoom
])

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGlobalHotkeysOptions {
  /** Enable debug logging */
  debug?: boolean
  /** Disable hotkey processing (e.g., when modal is open) */
  disabled?: boolean
  /** Called when a command is executed */
  onCommand?: (commandId: string) => void
  /** Called when settings command is triggered */
  onSettings?: () => void
  /** Called when terminal panel toggle is triggered (Ctrl+`) */
  onTerminal?: () => void
  /** Called when minibuffer cancel is triggered (esc in minibuffer scope) */
  onMinibufferCancel?: () => void
}

export interface UseGlobalHotkeysResult {
  /** Whether commands have been wired */
  isReady: boolean
  /** Last executed command ID */
  lastCommand: string | null
  /** Current sequence buffer */
  currentSequence: KeySequence
  /** Available which-key entries for current prefix */
  whichKeyEntries: readonly WhichKeyEntry[]
  /** Whether which-key popup should be visible */
  showWhichKey: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize key from event */
function normalizeKey(key: string): string {
  if (key === " ") return "space"
  if (key === "Escape") return "esc"
  if (key === "ArrowUp") return "up"
  if (key === "ArrowDown") return "down"
  if (key === "ArrowLeft") return "left"
  if (key === "ArrowRight") return "right"
  return key.toLowerCase()
}

/** Check if event target is an input element */
function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/**
 * Format a KeyChord to string for comparison with BROWSER_SHORTCUTS_TO_BLOCK.
 *
 * Format: "modifier+modifier+key" where modifiers are sorted: ctrl, alt, shift, meta
 * Examples: "ctrl+s", "alt+x", "ctrl+shift+p"
 */
function formatChordForBlocking(chord: KeyChord): string {
  const parts: string[] = []
  if (chord.ctrl) parts.push("ctrl")
  if (chord.alt) parts.push("alt")
  if (chord.shift) parts.push("shift")
  if (chord.meta) parts.push("meta")
  parts.push(chord.key)
  return parts.join("+")
}

/**
 * Check if we should block this chord from reaching the browser.
 *
 * Returns true if the chord matches a known browser shortcut we want to intercept.
 */
function shouldBlockBrowserShortcut(chord: KeyChord): boolean {
  const formatted = formatChordForBlocking(chord)
  return BROWSER_SHORTCUTS_TO_BLOCK.has(formatted)
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global hotkey handler hook.
 *
 * Mount this ONCE at the shell level (e.g., PersistentOverlays).
 * It wires all system commands and processes global keyboard events.
 *
 * Returns which-key state for rendering the popup.
 *
 * @example
 * ```tsx
 * function Shell() {
 *   const { isReady, showWhichKey, whichKeyEntries, currentSequence } = useGlobalHotkeys()
 *
 *   return (
 *     <>
 *       <App />
 *       {showWhichKey && (
 *         <WhichKeyPopup entries={whichKeyEntries} prefix={currentSequence} />
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export function useGlobalHotkeys(options: UseGlobalHotkeysOptions = {}): UseGlobalHotkeysResult {
  const { debug = false, disabled = false, onCommand, onSettings, onTerminal, onMinibufferCancel } = options

  const registry = useContext(RegistryContext)
  const minibuffer = useMinibuffer()

  // Wire commands via useCommandWire
  const { isWired } = useCommandWire({ debug })

  // Reactive state from atoms
  const currentSequence = useAtomValue(sequenceSourceAtom)
  const scopedBindings = useAtomValue(scopedBindingsAtom)
  const commands = useAtomValue(commandsSourceAtom)
  const whichKeyEntries = useAtomValue(whichKeyEntriesAtom)

  // Local state
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [showWhichKey, setShowWhichKey] = useState(false)
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const whichKeyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Execute a command by ID
  const executeCommand = useCallback(
    async (commandId: string) => {
      if (debug) {
        console.log(`[useGlobalHotkeys] Execute: ${commandId}`)
      }

      setLastCommand(commandId)
      setShowWhichKey(false)
      onCommand?.(commandId)

      // Special handling for command palette
      if (commandId === SPECIAL_COMMANDS.COMMAND_PALETTE) {
        await minibuffer.executeCommand()
        return
      }

      // Special handling for settings
      if (commandId === SPECIAL_COMMANDS.SETTINGS) {
        onSettings?.()
        return
      }

      // Special handling for terminal panel toggle (Ctrl+`)
      if (commandId === SPECIAL_COMMANDS.TERMINAL_PANEL) {
        console.log('[useGlobalHotkeys] Terminal command matched, calling onTerminal:', !!onTerminal)
        onTerminal?.()
        return
      }

      // Special handling for minibuffer cancel (esc in minibuffer scope)
      if (commandId === SPECIAL_COMMANDS.MINIBUFFER_CANCEL) {
        // Use the callback if provided, otherwise call minibuffer.cancel() directly
        if (onMinibufferCancel) {
          onMinibufferCancel()
        } else {
          await minibuffer.cancel()
        }
        return
      }

      // Special handling for testbed window picker (Ctrl+Shift+N)
      // Opens minibuffer with TestbedWindowProvider
      if (commandId === SPECIAL_COMMANDS.OPEN_TESTBED_WINDOW) {
        minibuffer.openCommand(TESTBED_WINDOW_PROVIDER_ID)
        return
      }

      // Execute generic command via Effect
      const command = commands.get(commandId)
      if (command) {
        try {
          await Effect.runPromise(command.handler)
        } catch (err) {
          console.error(`[useGlobalHotkeys] Command error:`, err)
        }
      }
    },
    [commands, minibuffer, onCommand, onSettings, onTerminal, onMinibufferCancel, debug]
  )

  // Global keydown handler
  useEffect(() => {
    console.log('[useGlobalHotkeys] Effect running, isWired:', isWired, 'disabled:', disabled)
    if (!isWired || disabled) {
      console.log('[useGlobalHotkeys] Skipping handler setup - isWired:', isWired, 'disabled:', disabled)
      return
    }

    console.log('[useGlobalHotkeys] Setting up keydown handler')

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[useGlobalHotkeys] RAW keydown:', e.key, 'ctrl:', e.ctrlKey)

      // Ignore modifier-only presses
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        return
      }

      // For input elements, only allow escape key through
      // This enables minibuffer cancel while typing in the search input
      if (isInputElement(e.target)) {
        if (e.key !== "Escape") {
          return
        }
        // Escape in input - let it through for minibuffer cancel
        console.log('[useGlobalHotkeys] Escape in input element, checking for minibuffer binding')
      }

      // Clear existing timeouts
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current)
        sequenceTimeoutRef.current = null
      }
      if (whichKeyTimeoutRef.current) {
        clearTimeout(whichKeyTimeoutRef.current)
        whichKeyTimeoutRef.current = null
      }
      setShowWhichKey(false)

      // Create chord from event
      const chord: KeyChord = {
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        key: normalizeKey(e.key),
      }

      // Block browser shortcuts unconditionally (VS Code pattern)
      // This prevents browser from handling shortcuts we want to intercept,
      // even if we don't have a binding for them yet.
      if (shouldBlockBrowserShortcut(chord)) {
        e.preventDefault()
        e.stopPropagation()

        if (debug) {
          console.log(`[useGlobalHotkeys] Blocked browser shortcut: ${formatChordForBlocking(chord)}`)
        }
      }

      // Process through pure function
      console.log('[useGlobalHotkeys] Processing key:', JSON.stringify(chord.key), 'keyCode:', chord.key.charCodeAt(0), 'ctrl:', chord.ctrl, 'scopedBindings:', scopedBindings.length)

      // Debug: Log all bindings that might match terminal
      if (chord.ctrl) {
        const terminalBindings = scopedBindings.filter(b => b.commandId.includes('terminal') || b.commandId.includes('Terminal'))
        console.log('[useGlobalHotkeys] Terminal bindings:', terminalBindings.map(b => ({
          keys: b.keys.map(k => `ctrl:${k.ctrl} key:${k.key}`),
          cmd: b.commandId
        })))
      }

      if (chord.key === 'esc') {
        console.log('[useGlobalHotkeys] ESC pressed! scopedBindings:', scopedBindings.map(b => ({ keys: b.keys[0]?.key, cmd: b.commandId, scope: b.scope })))
      }

      const { result } = processKeyboardEvent(
        chord,
        currentSequence,
        scopedBindings,
        commands
      )

      console.log('[useGlobalHotkeys] Result:', result.type, result.type === 'exact' ? result.binding?.commandId : '')

      if (result.type === "exact") {
        e.preventDefault()
        e.stopPropagation()

        if (debug) {
          console.log(`[useGlobalHotkeys] Match: ${result.binding.commandId}`)
        }

        // Execute command
        executeCommand(result.binding.commandId)

        // Reset sequence
        hotkeyActions.resetSequence(registry)
      } else if (result.type === "partial") {
        e.preventDefault()
        e.stopPropagation()

        if (debug) {
          console.log(`[useGlobalHotkeys] Partial: ${result.entries.length} options`)
        }

        // Update sequence
        hotkeyActions.appendToSequence(registry, chord)

        // Show which-key after delay
        whichKeyTimeoutRef.current = setTimeout(() => {
          setShowWhichKey(true)
        }, WHICH_KEY_DELAY)

        // Set timeout to reset sequence
        sequenceTimeoutRef.current = setTimeout(() => {
          if (debug) {
            console.log("[useGlobalHotkeys] Sequence timeout")
          }
          hotkeyActions.resetSequence(registry)
          setShowWhichKey(false)
        }, SEQUENCE_TIMEOUT)
      } else {
        // No match - reset sequence
        hotkeyActions.resetSequence(registry)
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current)
      }
      if (whichKeyTimeoutRef.current) {
        clearTimeout(whichKeyTimeoutRef.current)
      }
    }
  }, [
    isWired,
    disabled,
    currentSequence,
    scopedBindings,
    commands,
    registry,
    executeCommand,
    debug,
  ])

  return {
    isReady: isWired,
    lastCommand,
    currentSequence,
    whichKeyEntries,
    showWhichKey,
  }
}

export default useGlobalHotkeys
