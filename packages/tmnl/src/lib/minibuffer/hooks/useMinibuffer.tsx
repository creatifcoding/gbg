/**
 * useMinibuffer Hook
 *
 * Primary hook for minibuffer interaction from React components.
 * Exposes service operations and reactive state.
 *
 * @module
 */

import { useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { Effect } from "effect"
import { useDrawer, overlayId } from "@/lib/overlays"
import * as atoms from "../atoms"
import { MinibufferService } from "../services/MinibufferService"
import { MinibufferContent } from "../components/MinibufferContent"
import { MINIBUFFER_DRAWER_DEFAULTS } from "../schemas/minibuffer"
import type { HistoryKey, ProviderId } from "../schemas/minibuffer"
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

  // Reactive state
  const mode = useAtomValue(atoms.minibufferModeAtom)
  const input = useAtomValue(atoms.minibufferInputAtom)
  const prompt = useAtomValue(atoms.minibufferPromptAtom)
  const completions = useAtomValue(atoms.filteredCompletionsAtom)
  const selectedIndex = useAtomValue(atoms.minibufferSelectedIndexAtom)
  const isActive = useAtomValue(atoms.isMinibufferActiveAtom)
  const message = useAtomValue(atoms.minibufferMessageAtom)
  const selectedCompletion = useAtomValue(atoms.selectedCompletionAtom)

  // Open the drawer
  const openDrawer = useCallback(() => {
    drawer.open(
      {
        id: MINIBUFFER_DRAWER_ID,
        side: MINIBUFFER_DRAWER_DEFAULTS.side,
        height: MINIBUFFER_DRAWER_DEFAULTS.height,
        showBackdrop: MINIBUFFER_DRAWER_DEFAULTS.showBackdrop,
        closeOnBackdropClick: MINIBUFFER_DRAWER_DEFAULTS.closeOnOverlayClick,
        closeOnEscape: false, // We handle escape in the content
        persistence: MINIBUFFER_DRAWER_DEFAULTS.persistence,
      },
      <MinibufferContent />
    )
  }, [drawer])

  // Close the drawer
  const closeDrawer = useCallback(() => {
    drawer.close(MINIBUFFER_DRAWER_ID)
  }, [drawer])

  // Execute M-x command
  // ARCHITECTURAL NOTE: This now uses CommandService.executeInteractive() instead of
  // MinibufferService.executeCommand(). Commands OWN the M-x flow, minibuffer is just
  // the I/O pipe. CommandService internally uses MinibufferService.read() with
  // the CommandProvider from commands/.
  const executeCommand = useCallback(async () => {
    openDrawer()
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CommandService
        yield* svc.executeInteractive({ animate: 'slide' })
      }).pipe(Effect.provide(CommandService.Default))
    )
    closeDrawer()
  }, [openDrawer, closeDrawer])

  // Text prompt
  const promptText = useCallback(
    async (message: string, options?: { default?: string; historyKey?: HistoryKey }) => {
      openDrawer()
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* MinibufferService
          return yield* svc.prompt(message, options)
        }).pipe(Effect.provide(MinibufferService.Default))
      )
      closeDrawer()
      return result
    },
    [openDrawer, closeDrawer]
  )

  // Read with provider
  const read = useCallback(
    async (prompt: string, providerId: ProviderId, options?: { historyKey?: HistoryKey }) => {
      openDrawer()
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* MinibufferService
          return yield* svc.read(prompt, providerId, options)
        }).pipe(Effect.provide(MinibufferService.Default))
      )
      closeDrawer()
      return result
    },
    [openDrawer, closeDrawer]
  )

  // Yes/no prompt
  const yOrN = useCallback(
    async (prompt: string) => {
      openDrawer()
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* MinibufferService
          return yield* svc.yOrN(prompt)
        }).pipe(Effect.provide(MinibufferService.Default))
      )
      closeDrawer()
      return result
    },
    [openDrawer, closeDrawer]
  )

  // Show message
  const showMessage = useCallback(async (text: string, duration?: number) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MinibufferService
        yield* svc.message(text, duration)
      }).pipe(Effect.provide(MinibufferService.Default))
    )
  }, [])

  // Cancel
  const cancel = useCallback(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MinibufferService
        yield* svc.cancel()
      }).pipe(Effect.provide(MinibufferService.Default))
    )
    closeDrawer()
  }, [closeDrawer])

  // Navigation
  const navigateUp = useCallback(() => {
    atoms.navigateCompletions("up")
  }, [])

  const navigateDown = useCallback(() => {
    atoms.navigateCompletions("down")
  }, [])

  // Select current
  const selectCurrent = useCallback(async () => {
    const completion = atoms.Atom.get(atoms.selectedCompletionAtom)
    if (completion) {
      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* MinibufferService
          yield* svc.resolveWithCompletion(completion)
        }).pipe(Effect.provide(MinibufferService.Default))
      )
    }
  }, [])

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
