/**
 * @tmnl/stx — Fiber Exit Observer (Robust Error Propagation)
 *
 * Effect.runPromise rejects with a wrapped FiberFailure object — not a raw Cause.
 * Effect.runPromiseExit ALWAYS resolves with Exit<A,E> — never rejects.
 * BUT: there is no Effect.runPromiseExit in smol. Use Effect.runPromise(Effect.exit(...)).
 *
 * This module provides `watchFiberExit`: the canonical, exhaustive pattern for
 * observing fiber completion and propagating typed errors, defects, and interrupts
 * to the STX control plane atoms with maximum granularity.
 *
 * Cause API — VERIFIED against smol src (Cause.ts exports):
 *   hasInterruptsOnly(cause)  → ONLY interrupts, no errors or defects
 *   hasFails(cause)           → has typed domain error (E channel)
 *   hasDies(cause)            → has defect/crash (unhandled exception, Die)
 *   findError(cause)          → Result<E, Cause<never>>  (.success = E value)
 *   findDefect(cause)         → Result<unknown, Cause<E>> (.success = defect)
 *
 * Result in smol: Success has `.success` field (NOT `.value`!)
 *   Result.isSuccess(r) → true  → r.success is the value
 *   Result.isFailure(r) → true  → r.failure is the remaining cause
 *
 * NOT REAL in smol: failureOption, dieOption, failures, defects
 *
 * @module
 */

import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Cause from "effect/Cause"
import * as Result from "effect/Result"
import { type Atom, AtomRegistry } from "effect/unstable/reactivity"

// ─── StxFiberAtoms ────────────────────────────────────────────────────────────
// Intentionally uses read-only Atom<T> so callers can pass either
// Atom.Atom<T> or Atom.Writable<T,T> without type errors.
// Inside watchFiberExit, atoms are cast `as any` for registry.set —
// we know at runtime they're Writable (created with Atom.make(value)).
export interface StxFiberAtoms {
  readonly running: Atom.Atom<boolean>
  readonly done:    Atom.Atom<boolean>
  readonly error:   Atom.Atom<unknown>
}

/**
 * Exhaustive, maximum-granularity fiber exit observer.
 *
 * Watches `fiber` via `Effect.runPromise(Effect.exit(Fiber.join(fiber)))` —
 * which always resolves, never rejects — then routes the Exit to:
 *
 *   SUCCESS         → done=true, running=false
 *   INTERRUPT-ONLY  → silent (normal dispose), running=false
 *   FAIL (typed E)  → error atom gets typed error, running=false, done=false
 *   DIE (defect)    → error atom gets StxDefect wrapper, running=false
 *   MIXED           → all surfaces, isMixed=true
 *
 * @param fiber    The Fiber to observe (from Effect.runFork)
 * @param atoms    The STX control atoms to update
 * @param registry  The AtomRegistry to write into
 * @param onDone   Optional callback with the success value
 */
export function watchFiberExit<A, E>(
  fiber:    Fiber.Fiber<A, E>,
  atoms:    StxFiberAtoms,
  registry: AtomRegistry.AtomRegistry,
  onDone?:  (value: A) => void,
): void {
  // Effect.exit converts any Fiber join result to Exit<A,E>.
  // Effect.runPromise wrapping Effect.exit ALWAYS resolves — no rejection.
  Effect.runPromise(Effect.exit(Fiber.join(fiber))).then((exit) => {

    // Atoms are Writable at runtime but typed as Atom<T> for flexibility.
    // Use cast to satisfy registry.set() which requires Writable<T,T>.
    const set = <T>(atom: Atom.Atom<T>, value: T) =>
      registry.set(atom as any, value)

    if (Exit.isSuccess(exit)) {
      // ── Happy path ─────────────────────────────────────────────────────────
      set(atoms.done, true)
      set(atoms.running, false)
      onDone?.(exit.value)
      return
    }

    // ── Failure path — exhaustive Cause inspection ──────────────────────────
    const cause = exit.cause

    if (Cause.hasInterruptsOnly(cause)) {
      // Pure interrupt — normal dispose via control.dispose(), not an error.
      // Silently mark as not running. done=false (didn't complete normally).
      set(atoms.running, false)
      return
    }

    // ── Extract typed E failures (Cause.findError → Result<E, Cause<never>>) ─
    // IMPORTANT: Result.Success uses `.success` field, not `.value`
    let typedError: E | undefined = undefined
    if (Cause.hasFails(cause)) {
      const found = Cause.findError(cause) // Result<E, Cause<never>>
      if (Result.isSuccess(found)) {
        typedError = found.success // NOT found.value
      }
    }

    // ── Extract defects (Cause.findDefect → Result<unknown, Cause<E>>) ───────
    if (Cause.hasDies(cause)) {
      const found = Cause.findDefect(cause) // Result<unknown, Cause<E>>
      if (Result.isSuccess(found)) {
        const defect  = found.success // NOT found.value
        const isMixed = typedError !== undefined
        // Defect wraps in StxDefect — higher severity than typed fail.
        // If mixed: also surfaces the typed error via .typedError property.
        const stxErr = new StxDefect(defect, cause, isMixed ? typedError : undefined)
        set(atoms.error, stxErr)
        set(atoms.running, false)
        return
      }
    }

    // ── Pure typed failure (no defects) ─────────────────────────────────────
    // Surface the raw typed error directly — no wrapping.
    set(atoms.error, typedError)
    set(atoms.running, false)
    // done stays false — stream did not complete normally
  })
  // Note: the wrapping Effect.exit makes runPromise infallible here.
  // A rejection can only occur if the observer itself has a defect.
}

// ─── StxDefect ───────────────────────────────────────────────────────────────

/**
 * Rich defect wrapper for STX error atoms.
 * Carries the raw defect, the full Cause for devtools, and any
 * co-occurring typed error if the failure was mixed.
 */
export class StxDefect extends Error {
  readonly _tag = "StxDefect" as const
  readonly defect:     unknown
  readonly cause:      Cause.Cause<unknown>
  readonly typedError: unknown | undefined

  constructor(
    defect:      unknown,
    cause:       Cause.Cause<unknown>,
    typedError?: unknown,
  ) {
    const msg = defect instanceof Error
      ? defect.message
      : typeof defect === "string"
        ? defect
        : `[StxDefect] unhandled defect: ${String(defect)}`

    super(msg)
    this.name       = "StxDefect"
    this.defect     = defect
    this.cause      = cause
    this.typedError = typedError

    if (defect instanceof Error && defect.stack) {
      this.stack = defect.stack
    }
  }

  /** Pretty-print via Cause.squash for maximum diagnostic signal */
  squash(): unknown {
    return this.defect instanceof Error ? this.defect : this.cause
  }

  /** True if the cause also contained typed domain errors alongside the defect */
  get isMixed(): boolean {
    return this.typedError !== undefined
  }
}
