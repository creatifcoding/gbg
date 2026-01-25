/**
 * MinibufferService
 *
 * Effect.Service for Emacs-inspired minibuffer operations.
 * Uses Effect.Deferred for blocking semantics (prompt suspends until user input).
 *
 * Operations:
 * - prompt: Generic text input (read-string)
 * - read: Provider-based completion (completing-read)
 * - executeCommand: M-x command selection
 * - yOrN: Yes/no single-keypress prompt
 * - message: Echo area message display
 * - showWhichKey: Key chord hints
 *
 * @module
 */

import { Context, Effect, Layer, Deferred } from "effect"
import { Atom } from "@effect-atom/atom"
import * as atoms from "../atoms"
// NOTE: Import from index to trigger provider auto-registration side effect
import { providerRegistry, COMMAND_PROVIDER_ID } from "../providers"
import type { ProviderId, HistoryKey, MinibufferMode, Completion } from "../schemas/minibuffer"

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface MinibufferServiceImpl {
  /**
   * Show prompt and wait for string input.
   * Emacs: (read-string PROMPT &optional INITIAL HISTORY)
   */
  readonly prompt: (
    message: string,
    options?: { default?: string; historyKey?: HistoryKey }
  ) => Effect.Effect<string>

  /**
   * Read with completion provider.
   * Emacs: (completing-read PROMPT COLLECTION)
   */
  readonly read: (
    prompt: string,
    providerId: ProviderId,
    options?: { historyKey?: HistoryKey; requireSelection?: boolean }
  ) => Effect.Effect<string>

  /**
   * Execute M-x command selection.
   * Opens command palette, user selects, command executes.
   */
  readonly executeCommand: () => Effect.Effect<void>

  /**
   * Yes or no prompt (single keypress).
   * Emacs: (y-or-n-p PROMPT)
   */
  readonly yOrN: (prompt: string) => Effect.Effect<boolean>

  /**
   * Show message in echo area.
   * Emacs: (message FORMAT &rest ARGS)
   */
  readonly message: (text: string, duration?: number) => Effect.Effect<void>

  /**
   * Show which-key hints for prefix.
   */
  readonly showWhichKey: (prefix: string) => Effect.Effect<void>

  /**
   * Cancel current operation.
   * Resolves pending deferred with empty string.
   */
  readonly cancel: () => Effect.Effect<void>

  /**
   * Resolve pending input (called by UI on submit).
   */
  readonly resolve: (value: string) => Effect.Effect<void>

  /**
   * Resolve with selected completion (called by UI on selection).
   */
  readonly resolveWithCompletion: (completion: Completion) => Effect.Effect<void>

  /**
   * Update completions for current input.
   */
  readonly updateCompletions: (query: string) => Effect.Effect<void>

  /**
   * Get current mode.
   */
  readonly getMode: () => Effect.Effect<MinibufferMode>

  /**
   * Check if minibuffer is active.
   */
  readonly isActive: () => Effect.Effect<boolean>
}

// ─────────────────────────────────────────────────────────────
// Service Implementation
// ─────────────────────────────────────────────────────────────

export class MinibufferService extends Context.Tag("tmnl/minibuffer/MinibufferService")<
  MinibufferService,
  MinibufferServiceImpl
>() {
  static Default = Layer.succeed(
    this,
    MinibufferService.of({
      // ─── prompt ───────────────────────────────────────────────
      prompt: (message, options) =>
        Effect.gen(function* () {
          // Set mode and prompt
          Atom.set(atoms.minibufferModeAtom, "prompt")
          Atom.set(atoms.minibufferPromptAtom, message)
          Atom.set(atoms.minibufferInputAtom, options?.default ?? "")
          Atom.set(atoms.minibufferSelectedIndexAtom, 0)

          // Create deferred for blocking
          const deferred = yield* Deferred.make<string, never>()
          Atom.set(atoms.pendingDeferredAtom, deferred)

          // Wait for resolution
          const result = yield* Deferred.await(deferred)

          // Add to history
          if (options?.historyKey && result) {
            atoms.addToHistory(options.historyKey, result)
          }

          // Reset
          atoms.resetMinibuffer()

          return result
        }),

      // ─── read ─────────────────────────────────────────────────
      read: (prompt, providerId, options) =>
        Effect.gen(function* () {
          const provider = providerRegistry.get(providerId)
          if (!provider) {
            yield* Effect.logWarning(`Unknown provider: ${providerId}`)
            return ""
          }

          console.log('[MinibufferService.read] Starting with provider:', providerId)

          // Set mode
          Atom.set(atoms.minibufferModeAtom, "command")
          Atom.set(atoms.minibufferPromptAtom, provider.placeholder ?? prompt)
          Atom.set(atoms.activeProviderAtom, providerId)
          Atom.set(atoms.minibufferInputAtom, "")
          Atom.set(atoms.minibufferSelectedIndexAtom, 0)

          // Initial completions
          const initial = yield* provider.complete("")
          Atom.set(atoms.minibufferCompletionsAtom, initial)

          // Create deferred
          const deferred = yield* Deferred.make<string, never>()
          console.log('[MinibufferService.read] Created Deferred, storing in atom')
          Atom.set(atoms.pendingDeferredAtom, deferred)
          console.log('[MinibufferService.read] Deferred stored, now awaiting...')

          // Wait for resolution
          const result = yield* Deferred.await(deferred)
          console.log('[MinibufferService.read] Deferred resolved with:', result)

          // Add to history
          if (options?.historyKey && result) {
            atoms.addToHistory(options.historyKey, result)
          }

          // Reset
          atoms.resetMinibuffer()

          return result
        }),

      // ─── executeCommand ───────────────────────────────────────
      executeCommand: () =>
        Effect.gen(function* () {
          console.log('[MinibufferService.executeCommand] Starting')
          const provider = providerRegistry.get(COMMAND_PROVIDER_ID)
          if (!provider) {
            yield* Effect.logWarning("CommandProvider not registered")
            return
          }

          // Set mode
          console.log('[MinibufferService.executeCommand] Setting up atoms')
          Atom.set(atoms.minibufferModeAtom, "command")
          Atom.set(atoms.minibufferPromptAtom, provider.placeholder ?? "M-x ")
          Atom.set(atoms.activeProviderAtom, COMMAND_PROVIDER_ID)
          Atom.set(atoms.minibufferInputAtom, "")
          Atom.set(atoms.minibufferSelectedIndexAtom, 0)

          // Initial completions
          const initial = yield* provider.complete("")
          Atom.set(atoms.minibufferCompletionsAtom, initial)
          console.log('[MinibufferService.executeCommand] Completions set:', initial.length)

          // Create deferred
          const deferred = yield* Deferred.make<string, never>()
          console.log('[MinibufferService.executeCommand] Created Deferred, storing in atom')
          Atom.set(atoms.pendingDeferredAtom, deferred)
          console.log('[MinibufferService.executeCommand] Deferred stored, now awaiting...')

          // Wait for resolution (returns command ID or empty on cancel)
          const commandId = yield* Deferred.await(deferred)
          console.log('[MinibufferService.executeCommand] Deferred resolved with:', commandId)

          // Reset minibuffer
          atoms.resetMinibuffer()

          // Execute command if selected
          if (commandId) {
            console.log('[MinibufferService.executeCommand] Executing command:', commandId)
            const completion: Completion = { value: commandId, label: "" }
            yield* provider.onSelect(completion)
          }
        }),

      // ─── yOrN ─────────────────────────────────────────────────
      yOrN: (prompt) =>
        Effect.gen(function* () {
          Atom.set(atoms.minibufferModeAtom, "y-or-n")
          Atom.set(atoms.minibufferPromptAtom, `${prompt} (y or n) `)
          Atom.set(atoms.minibufferInputAtom, "")

          // Create deferred
          const deferred = yield* Deferred.make<string, never>()
          Atom.set(atoms.pendingDeferredAtom, deferred)

          // Wait for single keypress
          const result = yield* Deferred.await(deferred)

          // Reset
          atoms.resetMinibuffer()

          return result.toLowerCase() === "y"
        }),

      // ─── message ──────────────────────────────────────────────
      message: (text, duration = 3000) =>
        Effect.gen(function* () {
          atoms.setMessage(text, Date.now())

          if (duration > 0) {
            yield* Effect.sleep(duration)
            // Only clear if this is still the active message
            const current = Atom.get(atoms.minibufferMessageAtom)
            if (current === text) {
              atoms.clearMessage()
            }
          }
        }),

      // ─── showWhichKey ─────────────────────────────────────────
      showWhichKey: (prefix) =>
        Effect.sync(() => {
          Atom.set(atoms.minibufferModeAtom, "which-key")
          Atom.set(atoms.whichKeyPrefixAtom, prefix)
          // Which-key entries are populated by the hotkey system
        }),

      // ─── cancel ───────────────────────────────────────────────
      cancel: () =>
        Effect.gen(function* () {
          const deferred = Atom.get(atoms.pendingDeferredAtom)
          if (deferred) {
            yield* Deferred.succeed(deferred, "")
          }
          atoms.resetMinibuffer()
        }),

      // ─── resolve ──────────────────────────────────────────────
      resolve: (value) =>
        Effect.gen(function* () {
          const deferred = Atom.get(atoms.pendingDeferredAtom)
          if (deferred) {
            yield* Deferred.succeed(deferred, value)
          }
        }),

      // ─── resolveWithCompletion ────────────────────────────────
      resolveWithCompletion: (completion) =>
        Effect.gen(function* () {
          const deferred = Atom.get(atoms.pendingDeferredAtom)
          console.log('[MinibufferService.resolveWithCompletion] deferred:', deferred ? 'EXISTS' : 'NULL')
          if (deferred) {
            const value = typeof completion.value === "string"
              ? completion.value
              : String(completion.value)
            console.log('[MinibufferService.resolveWithCompletion] Calling Deferred.succeed with:', value)
            yield* Deferred.succeed(deferred, value)
            console.log('[MinibufferService.resolveWithCompletion] Deferred.succeed completed')
          } else {
            console.warn('[MinibufferService.resolveWithCompletion] NO DEFERRED FOUND!')
          }
        }),

      // ─── updateCompletions ────────────────────────────────────
      updateCompletions: (query) =>
        Effect.gen(function* () {
          const providerId = Atom.get(atoms.activeProviderAtom)
          if (!providerId) return

          const provider = providerRegistry.get(providerId)
          if (!provider) return

          // Transform input if provider specifies
          const transformedQuery = provider.transformInput
            ? provider.transformInput(query)
            : query

          const completions = yield* provider.complete(transformedQuery)
          Atom.set(atoms.minibufferCompletionsAtom, completions)
          Atom.set(atoms.minibufferSelectedIndexAtom, 0)
        }),

      // ─── getMode ──────────────────────────────────────────────
      getMode: () => Effect.sync(() => Atom.get(atoms.minibufferModeAtom)),

      // ─── isActive ─────────────────────────────────────────────
      isActive: () => Effect.sync(() => Atom.get(atoms.isMinibufferActiveAtom)),
    })
  )
}
