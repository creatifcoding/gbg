/**
 * useMinibuffer Hook
 *
 * Primary hook for minibuffer interaction from React components.
 * Exposes service operations and reactive state.
 *
 * @module
 */

import { useCallback, useMemo, useContext, useRef } from "react"
import { useAtomValue, useAtomSet, RegistryContext } from "@effect-atom/atom-react"
import { Effect, Exit } from "effect"
import { useDrawer, overlayId } from "@/lib/overlays"
import * as atoms from "../atoms"
import { minibufferAtoms } from "../atoms/runtime"
import { MinibufferContent } from "../components/MinibufferContent"
import { MINIBUFFER_DRAWER_DEFAULTS } from "../schemas/minibuffer"
import type { HistoryKey, ProviderId } from "../schemas/minibuffer"
import { hotkeyActions, Scopes, BindingSources, bindingsSourceAtom } from "@/lib/hotkeys"
import { COMMAND_PROVIDER_ID } from "@/lib/commands/CommandProvider"
import { providerRegistry } from "../providers"
import { CommandService } from "@/lib/commands/service"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MINIBUFFER_DRAWER_ID = overlayId("minibuffer")

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface UseMinibufferReturn {
  /** Current mode */
  mode: atoms.MinibufferMode
  /** Current input text */
  input: string
  /** Current prompt */
  prompt: string
  /** Available completions */
  completions: readonly atoms.Completion[]
  /** Selected index */
  selectedIndex: number
  /** Selected completion */
  selectedCompletion: atoms.Completion | null
  /** Whether minibuffer is active */
  isActive: boolean
  /** Echo message */
  message: string

  /** Open M-x command palette */
  executeCommand: () => Promise<void>
  /** Show text prompt */
  promptText: (message: string, options?: { default?: string; historyKey?: HistoryKey }) => Promise<string>
  /** Read with provider */
  read: (prompt: string, providerId: ProviderId, options?: { historyKey?: HistoryKey }) => Promise<string>
  /** Yes/no prompt */
  yOrN: (prompt: string) => Promise<boolean>
  /** Show message */
  showMessage: (text: string, duration?: number) => Promise<void>
  /** Cancel current operation */
  cancel: () => Promise<void>
  /** Navigate completions */
  navigateUp: () => void
  navigateDown: () => void
  /** Select current completion */
  selectCurrent: () => Promise<void>
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useMinibuffer(): UseMinibufferReturn {
  const drawer = useDrawer()
  const registry = useContext(RegistryContext)

  // Track if minibuffer scope is active (prevent double push/pop)
  const scopeActiveRef = useRef(false)

  // Reactive state
  const mode = useAtomValue(atoms.minibufferModeAtom)
  const input = useAtomValue(atoms.minibufferInputAtom)
  const prompt = useAtomValue(atoms.minibufferPromptAtom)
  const completions = useAtomValue(atoms.filteredCompletionsAtom)
  const selectedIndex = useAtomValue(atoms.minibufferSelectedIndexAtom)
  const isActive = useAtomValue(atoms.isMinibufferActiveAtom)
  const message = useAtomValue(atoms.minibufferMessageAtom)
  const selectedCompletion = useAtomValue(atoms.selectedCompletionAtom)

  // ─────────────────────────────────────────────────────────────
  // Effect-atom operation functions (AtomResultFn → callable via useAtomSet)
  // These share the same MinibufferService instance for proper Deferred handling
  // ─────────────────────────────────────────────────────────────
  const doCancel = useAtomSet(minibufferAtoms.cancel, { mode: "promiseExit" })
  const doResolve = useAtomSet(minibufferAtoms.resolve, { mode: "promiseExit" })
  const doResolveWithCompletion = useAtomSet(minibufferAtoms.resolveWithCompletion, { mode: "promiseExit" })
  const doMessage = useAtomSet(minibufferAtoms.message, { mode: "promiseExit" })
  const doPrompt = useAtomSet(minibufferAtoms.prompt, { mode: "promiseExit" })
  const doRead = useAtomSet(minibufferAtoms.read, { mode: "promiseExit" })
  const doYOrN = useAtomSet(minibufferAtoms.yOrN, { mode: "promiseExit" })
  const doExecuteCommand = useAtomSet(minibufferAtoms.executeCommand, { mode: "promiseExit" })

  // Push minibuffer scope and register esc binding
  const pushMinibufferScope = useCallback(() => {
    if (scopeActiveRef.current) return
    scopeActiveRef.current = true

    console.log('[minibuffer] Pushing scope:', Scopes.MINIBUFFER)

    // Push scope onto stack (Emacs minor mode pattern)
    hotkeyActions.pushScope(registry, Scopes.MINIBUFFER)

    // Register 'esc' binding in minibuffer scope
    // This will be automatically filtered out when scope is popped
    // NOTE: Use 'esc' (normalized form) not 'Escape' (DOM event form)
    const binding = {
      keys: [{ ctrl: false, alt: false, shift: false, meta: false, key: 'esc' }],
      commandId: 'minibuffer.cancel',
      scope: Scopes.MINIBUFFER,
      priority: 100, // High priority within minibuffer scope
      source: BindingSources.DEFAULT, // TokenRegistry-validated source
    }
    console.log('[minibuffer] Adding esc binding:', binding)
    hotkeyActions.addBinding(registry, binding)

    // Debug: check current bindings
    const bindings = registry.get(bindingsSourceAtom)
    console.log('[minibuffer] Total bindings after add:', bindings.length)
    const escBindings = bindings.filter((b: any) => b.keys[0]?.key === 'esc')
    console.log('[minibuffer] Esc bindings:', escBindings)
  }, [registry])

  // Pop minibuffer scope (removes esc binding automatically via scope filtering)
  const popMinibufferScope = useCallback(() => {
    if (!scopeActiveRef.current) return
    scopeActiveRef.current = false

    // Remove the esc binding explicitly (belt and suspenders)
    hotkeyActions.removeBinding(
      registry,
      [{ ctrl: false, alt: false, shift: false, meta: false, key: 'esc' }],
      Scopes.MINIBUFFER
    )

    // Pop scope from stack
    hotkeyActions.popScope(registry)
  }, [registry])

  // Open the drawer
  const openDrawer = useCallback(() => {
    // Push minibuffer scope BEFORE opening drawer
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

  // Close the drawer
  const closeDrawer = useCallback(() => {
    drawer.close(MINIBUFFER_DRAWER_ID)

    // Pop minibuffer scope AFTER closing drawer
    popMinibufferScope()
  }, [drawer, popMinibufferScope])

  // Execute M-x command
  // Sets up atoms via registry (React-visible), then uses shared runtime for Deferred
  const executeCommand = useCallback(async () => {
    console.log('[useMinibuffer.executeCommand] Starting M-x')

    // Get the command provider
    const provider = providerRegistry.get(COMMAND_PROVIDER_ID)
    if (!provider) {
      console.warn('[useMinibuffer.executeCommand] CommandProvider not registered')
      return
    }

    // Set up atoms via REGISTRY (React-visible) - this is critical!
    // Service's Atom.set() writes to global store which React can't see
    registry.set(atoms.minibufferModeAtom, 'command')
    registry.set(atoms.minibufferPromptAtom, provider.placeholder ?? 'M-x ')
    registry.set(atoms.activeProviderAtom, COMMAND_PROVIDER_ID)
    registry.set(atoms.minibufferInputAtom, '')
    registry.set(atoms.minibufferSelectedIndexAtom, 0)

    // Get initial completions
    const initialCompletions = await Effect.runPromise(
      provider.complete('').pipe(Effect.provide(CommandService.Default))
    )
    console.log('[useMinibuffer.executeCommand] Completions loaded:', initialCompletions.length)
    registry.set(atoms.minibufferCompletionsAtom, initialCompletions)

    // Open drawer (state is ready)
    openDrawer()

    // Use the shared runtime's executeCommand for Deferred handling
    // The service will create Deferred and await - we've already set up atoms
    const exit = await doExecuteCommand()

    console.log('[useMinibuffer.executeCommand] executeCommand completed, exit:', Exit.isSuccess(exit) ? 'success' : 'failure')

    // Close drawer after command completes (or is cancelled)
    closeDrawer()
  }, [openDrawer, closeDrawer, doExecuteCommand, registry])

  // Text prompt
  // All blocking operations use useAtomSet for proper Deferred handling via shared runtime

  const promptText = useCallback(
    async (msg: string, options?: { default?: string; historyKey?: HistoryKey }) => {
      openDrawer()
      const exit = await doPrompt({ message: msg, options })
      closeDrawer()
      if (Exit.isSuccess(exit)) return exit.value
      return '' // Cancelled or failed
    },
    [openDrawer, closeDrawer, doPrompt]
  )

  // Read with provider
  const read = useCallback(
    async (promptStr: string, providerId: ProviderId, options?: { historyKey?: HistoryKey }) => {
      openDrawer()
      const exit = await doRead({ prompt: promptStr, providerId, options })
      closeDrawer()
      if (Exit.isSuccess(exit)) return exit.value
      return '' // Cancelled or failed
    },
    [openDrawer, closeDrawer, doRead]
  )

  // Yes/no prompt
  const yOrN = useCallback(
    async (promptStr: string) => {
      openDrawer()
      const exit = await doYOrN(promptStr)
      closeDrawer()
      if (Exit.isSuccess(exit)) return exit.value
      return false // Cancelled or failed
    },
    [openDrawer, closeDrawer, doYOrN]
  )

  // Show message
  const showMessage = useCallback(async (text: string, duration?: number) => {
    await doMessage({ text, duration })
  }, [doMessage])

  // Cancel — uses shared runtime to properly resolve Deferred
  const cancel = useCallback(async () => {
    console.log('[minibuffer] cancel() called')
    const exit = await doCancel()
    console.log('[minibuffer] cancel() completed, exit:', Exit.isSuccess(exit) ? 'success' : 'failure')
    closeDrawer()
  }, [closeDrawer, doCancel])

  // Navigation
  const navigateUp = useCallback(() => {
    atoms.navigateCompletions("up")
  }, [])

  const navigateDown = useCallback(() => {
    atoms.navigateCompletions("down")
  }, [])

  // Select current — uses shared runtime
  const selectCurrent = useCallback(async () => {
    const completion = atoms.Atom.get(atoms.selectedCompletionAtom)
    if (completion) {
      await doResolveWithCompletion(completion)
    }
  }, [doResolveWithCompletion])

  return useMemo(
    () => ({
      mode,
      input,
      prompt,
      completions,
      selectedIndex,
      selectedCompletion,
      isActive,
      message,
      executeCommand,
      promptText,
      read,
      yOrN,
      showMessage,
      cancel,
      navigateUp,
      navigateDown,
      selectCurrent,
    }),
    [
      mode,
      input,
      prompt,
      completions,
      selectedIndex,
      selectedCompletion,
      isActive,
      message,
      executeCommand,
      promptText,
      read,
      yOrN,
      showMessage,
      cancel,
      navigateUp,
      navigateDown,
      selectCurrent,
    ]
  )
}
