/**
 * Minibuffer v2 — React Hooks
 *
 * Primary hook for minibuffer interaction.
 * Manages drawer lifecycle, hotkey scopes, and exposes v2 atoms/ops.
 *
 * Key difference from v1:
 * - Event-driven, not blocking (no Deferred)
 * - Uses XState machine via ops
 * - Watches modeAtom to auto-close drawer when operation completes
 *
 * @module
 */

import { useCallback, useMemo, useEffect, useRef, useContext } from "react"
import { useAtomValue, RegistryContext } from "@effect-atom/atom-react"
import { Effect } from "effect"
import {
  isActiveAtom,
  modeAtom,
  inputAtom,
  promptAtom,
  completionsAtom,
  selectedIndexAtom,
  selectedCompletionAtom,
  ops,
} from "./atoms"
import { COMMAND_PROVIDER_ID, getCompletions } from "./providers"
import { MinibufferContent } from "./components"
import type { ProviderId, Completion, WhichKeyEntry } from "./machine"
import { useDrawer, overlayId } from "@/lib/overlays"
import { hotkeyActions, Scopes, BindingSources } from "@/lib/hotkeys"

// ============================================================================
// CONSTANTS
// ============================================================================

const MINIBUFFER_DRAWER_ID = overlayId("minibuffer-v2")

const MINIBUFFER_DRAWER_DEFAULTS = {
  side: "bottom" as const,
  height: "280px",
  showBackdrop: false,
  closeOnOverlayClick: false,
  persistence: "ephemeral" as const,
}

// ============================================================================
// TYPES
// ============================================================================

export interface UseMinibufferReturn {
  /** Whether minibuffer is currently active */
  isActive: boolean
  /** Current mode: "idle" | "prompt" | "command" | "yOrN" | "whichKey" */
  mode: string
  /** Current input value */
  input: string
  /** Current prompt text */
  prompt: string
  /** Available completions */
  completions: readonly Completion[]
  /** Selected completion index */
  selectedIndex: number
  /** Currently selected completion */
  selectedCompletion: Completion | null

  // ─── Operations ─────────────────────────────────────────────

  /** Open command palette (M-x) */
  executeCommand: () => void
  /** Open prompt mode */
  openPrompt: (promptText: string, defaultValue?: string) => void
  /** Open command mode with specific provider */
  openCommand: (providerId: ProviderId) => void
  /** Open y-or-n prompt */
  yOrN: (promptText: string) => void
  /** Open which-key hints */
  whichKey: (prefix: string, entries: readonly WhichKeyEntry[]) => void
  /** Cancel current operation */
  cancel: () => void
  /** Submit current input/selection */
  submit: () => void
  /** Navigate to next completion */
  navigateDown: () => void
  /** Navigate to previous completion */
  navigateUp: () => void
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Primary hook for minibuffer interaction.
 *
 * Manages:
 * - Drawer lifecycle (open/close)
 * - Hotkey scope (push/pop minibuffer scope)
 * - State via v2 atoms
 * - Operations via v2 ops
 *
 * @example
 * ```tsx
 * function CommandButton() {
 *   const { isActive, executeCommand, cancel } = useMinibuffer()
 *
 *   return (
 *     <button onClick={isActive ? cancel : executeCommand}>
 *       {isActive ? 'Cancel' : 'M-x'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useMinibuffer(): UseMinibufferReturn {
  const drawer = useDrawer()
  const registry = useContext(RegistryContext)

  // Track scope state to prevent double push/pop
  const scopeActiveRef = useRef(false)
  // Track if we opened the drawer (to know if we should close it)
  const drawerOpenedRef = useRef(false)

  // Reactive state from v2 atoms
  const isActive = useAtomValue(isActiveAtom)
  const mode = useAtomValue(modeAtom)
  const input = useAtomValue(inputAtom)
  const prompt = useAtomValue(promptAtom)
  const completions = useAtomValue(completionsAtom)
  const selectedIndex = useAtomValue(selectedIndexAtom)
  const selectedCompletion = useAtomValue(selectedCompletionAtom)

  // ─────────────────────────────────────────────────────────────
  // Hotkey Scope Management
  // ─────────────────────────────────────────────────────────────

  const pushMinibufferScope = useCallback(() => {
    if (scopeActiveRef.current) return
    scopeActiveRef.current = true

    // Push scope onto stack (Emacs minor mode pattern)
    hotkeyActions.pushScope(registry, Scopes.MINIBUFFER)

    // Register 'esc' binding in minibuffer scope
    const binding = {
      keys: [{ ctrl: false, alt: false, shift: false, meta: false, key: 'esc' }],
      commandId: 'minibuffer.cancel',
      scope: Scopes.MINIBUFFER,
      priority: 100,
      source: BindingSources.DEFAULT,
    }
    hotkeyActions.addBinding(registry, binding)
  }, [registry])

  const popMinibufferScope = useCallback(() => {
    if (!scopeActiveRef.current) return
    scopeActiveRef.current = false

    // Remove the esc binding explicitly
    hotkeyActions.removeBinding(
      registry,
      [{ ctrl: false, alt: false, shift: false, meta: false, key: 'esc' }],
      Scopes.MINIBUFFER
    )

    // Pop scope from stack
    hotkeyActions.popScope(registry)
  }, [registry])

  // ─────────────────────────────────────────────────────────────
  // Drawer Management
  // ─────────────────────────────────────────────────────────────

  const openDrawer = useCallback(() => {
    if (drawerOpenedRef.current) return
    drawerOpenedRef.current = true

    // Push hotkey scope first
    pushMinibufferScope()

    drawer.open(
      {
        id: MINIBUFFER_DRAWER_ID,
        side: MINIBUFFER_DRAWER_DEFAULTS.side,
        height: MINIBUFFER_DRAWER_DEFAULTS.height,
        showBackdrop: MINIBUFFER_DRAWER_DEFAULTS.showBackdrop,
        closeOnBackdropClick: MINIBUFFER_DRAWER_DEFAULTS.closeOnOverlayClick,
        closeOnEscape: false, // We handle escape via hotkey scope
        persistence: MINIBUFFER_DRAWER_DEFAULTS.persistence,
      },
      <MinibufferContent />
    )
  }, [drawer, pushMinibufferScope])

  const closeDrawer = useCallback(() => {
    if (!drawerOpenedRef.current) return
    drawerOpenedRef.current = false

    drawer.close(MINIBUFFER_DRAWER_ID)
    popMinibufferScope()
  }, [drawer, popMinibufferScope])

  // ─────────────────────────────────────────────────────────────
  // Auto-close drawer when mode transitions to idle
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // If mode goes to idle and we had opened the drawer, close it
    if (mode === "idle" && drawerOpenedRef.current) {
      closeDrawer()
    }
  }, [mode, closeDrawer])

  // ─────────────────────────────────────────────────────────────
  // Operations
  // ─────────────────────────────────────────────────────────────

  const executeCommand = useCallback(() => {
    openDrawer()
    ops.openCommand(COMMAND_PROVIDER_ID)

    // Fetch initial completions
    Effect.runPromise(getCompletions(COMMAND_PROVIDER_ID, "")).then(results => {
      ops.loadCompletions(results)
    })
  }, [openDrawer])

  const openPrompt = useCallback((promptText: string, defaultValue?: string) => {
    openDrawer()
    ops.openPrompt(promptText, defaultValue)
  }, [openDrawer])

  const openCommand = useCallback((providerId: ProviderId) => {
    openDrawer()
    ops.openCommand(providerId)

    // Fetch initial completions
    Effect.runPromise(getCompletions(providerId, "")).then(results => {
      ops.loadCompletions(results)
    })
  }, [openDrawer])

  const yOrN = useCallback((promptText: string) => {
    openDrawer()
    ops.openYOrN(promptText)
  }, [openDrawer])

  const whichKey = useCallback((prefix: string, entries: readonly WhichKeyEntry[]) => {
    openDrawer()
    ops.openWhichKey(prefix, entries)
  }, [openDrawer])

  const cancel = useCallback(() => {
    ops.cancel()
    // Drawer will auto-close via the useEffect watching mode
  }, [])

  const submit = useCallback(() => {
    ops.submit()
    // Drawer will auto-close via the useEffect watching mode
  }, [])

  const navigateDown = useCallback(() => {
    ops.selectNext()
  }, [])

  const navigateUp = useCallback(() => {
    ops.selectPrev()
  }, [])

  // Callbacks are stable (useCallback with stable deps).
  // Only reactive atom values need to trigger re-memoization.
  return useMemo(
    (): UseMinibufferReturn => ({
      // Reactive state (from atoms)
      isActive,
      mode,
      input,
      prompt,
      completions,
      selectedIndex,
      selectedCompletion,
      // Stable operations (useCallback-wrapped)
      executeCommand,
      openPrompt,
      openCommand,
      yOrN,
      whichKey,
      cancel,
      submit,
      navigateDown,
      navigateUp,
    }),
    // Only atom-derived values — callbacks are referentially stable
    [isActive, mode, input, prompt, completions, selectedIndex, selectedCompletion]
  )
}
