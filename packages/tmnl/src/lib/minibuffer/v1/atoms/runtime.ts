/**
 * Minibuffer Runtime Atom
 *
 * Separated from index.ts to avoid circular dependency:
 * atoms/index.ts <- MinibufferService.ts <- atoms/index.ts
 *
 * This file is imported by consumers, not by MinibufferService.
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"
import { Deferred, Effect } from "effect"
import { MinibufferService } from "../services/MinibufferService"
import type { Completion, HistoryKey, ProviderId } from "../schemas/minibuffer"
import { pendingDeferredAtom } from "./index"

// ─────────────────────────────────────────────────────────────
// Runtime Atom (Shared Service Context)
// ─────────────────────────────────────────────────────────────

/**
 * Shared runtime for MinibufferService operations.
 *
 * All operations through this runtime share the same service instance,
 * which is critical for Deferred resolution across different call sites.
 *
 * Pattern: Atom.runtime creates a ManagedRuntime under the hood.
 * Cleanup: Handled automatically by effect-atom's Registry when
 * the RegistryProvider unmounts - no useEffect needed.
 */
export const minibufferRuntimeAtom = Atom.runtime(MinibufferService.Default)

// ─────────────────────────────────────────────────────────────
// Runtime Operations (Shared Context)
// ─────────────────────────────────────────────────────────────

/**
 * Minibuffer operation atoms (AtomResultFn).
 *
 * IMPORTANT: These are ATOMS, not functions!
 * To call them:
 * - In React: `const fn = useAtomSet(atom, { mode: "promiseExit" }); await fn(args)`
 * - Outside React: `registry.set(atom, args)`
 *
 * This ensures all operations share the same MinibufferService instance,
 * which is critical for Deferred resolution across different call sites.
 */
export const minibufferAtoms = {
  /**
   * Cancel the current operation.
   * Resolves pending Deferred with empty string.
   */
  cancel: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (_?: void) {
      const svc = yield* MinibufferService
      yield* svc.cancel()
    })
  ),

  /**
   * Resolve the current operation with a value.
   */
  resolve: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (value: string) {
      const svc = yield* MinibufferService
      yield* svc.resolve(value)
    })
  ),

  /**
   * Resolve with a completion's value.
   * Uses Effect.runSync for immediate cross-fiber Deferred resolution.
   * The yield* approach was blocking due to fiber context issues.
   */
  resolveWithCompletion: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (completion: Completion) {
      console.log('[minibufferAtoms.resolveWithCompletion] Called with:', completion.label)
      const deferred = Atom.get(pendingDeferredAtom)
      console.log('[minibufferAtoms.resolveWithCompletion] Deferred from atom:', deferred ? 'EXISTS' : 'NULL')
      if (deferred) {
        const value = typeof completion.value === "string"
          ? completion.value
          : String(completion.value)
        console.log('[minibufferAtoms.resolveWithCompletion] Calling Deferred.succeed with:', value)
        // Use runSync to immediately resolve - yield* was blocking due to fiber context
        const result = Effect.runSync(Deferred.succeed(deferred, value))
        console.log('[minibufferAtoms.resolveWithCompletion] Deferred.succeed returned:', result)
      } else {
        console.warn('[minibufferAtoms.resolveWithCompletion] NO DEFERRED FOUND!')
      }
    })
  ),

  /**
   * Show an echo message.
   */
  message: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (args: { text: string; duration?: number }) {
      const svc = yield* MinibufferService
      yield* svc.message(args.text, args.duration)
    })
  ),

  // ─── Blocking Operations (Create + Await Deferred) ─────────────

  /**
   * Prompt for text input.
   * Blocks until user submits or cancels.
   */
  prompt: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (args: { message: string; options?: { default?: string; historyKey?: HistoryKey } }) {
      const svc = yield* MinibufferService
      return yield* svc.prompt(args.message, args.options)
    })
  ),

  /**
   * Read with completion provider.
   * Blocks until user selects or cancels.
   */
  read: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (args: { prompt: string; providerId: ProviderId; options?: { historyKey?: HistoryKey } }) {
      const svc = yield* MinibufferService
      return yield* svc.read(args.prompt, args.providerId, args.options)
    })
  ),

  /**
   * Yes/no prompt.
   * Blocks until user presses y or n.
   */
  yOrN: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (prompt: string) {
      const svc = yield* MinibufferService
      return yield* svc.yOrN(prompt)
    })
  ),

  /**
   * Execute command (M-x).
   * Blocks until user selects command or cancels.
   */
  executeCommand: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (_?: void) {
      const svc = yield* MinibufferService
      return yield* svc.executeCommand()
    })
  ),
}
