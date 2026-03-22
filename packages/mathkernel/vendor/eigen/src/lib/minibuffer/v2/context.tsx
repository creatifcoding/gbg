/**
 * Minibuffer v2 — React Context
 *
 * Global singleton actor using createActorContext.
 * Components use useMinibufferActor() to send events,
 * useMinibufferSelector() to subscribe to state slices.
 *
 * @module
 */

import { createActorContext } from "@xstate/react"
import { minibufferMachine } from "./machine"
import type { MinibufferSnapshot, Completion } from "./machine"

// ─────────────────────────────────────────────────────────────
// Actor Context (Singleton)
// ─────────────────────────────────────────────────────────────

/**
 * Global minibuffer actor context.
 *
 * Wrap your app with <MinibufferProvider> to enable minibuffer functionality.
 * Use hooks below to interact with the minibuffer.
 */
export const MinibufferReactContext = createActorContext(minibufferMachine)

/**
 * Provider component. Place at app root.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <MinibufferProvider>
 *       <YourApp />
 *     </MinibufferProvider>
 *   )
 * }
 * ```
 */
export const MinibufferProvider = MinibufferReactContext.Provider

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Get the minibuffer actor reference.
 * Use this to send events to the minibuffer.
 *
 * @example
 * ```tsx
 * function CommandPaletteTrigger() {
 *   const actor = useMinibufferActor()
 *
 *   const openCommandPalette = () => {
 *     actor.send({
 *       type: 'OPEN_COMMAND',
 *       providerId: COMMAND_PROVIDER_ID,
 *       prompt: 'M-x '
 *     })
 *   }
 *
 *   return <button onClick={openCommandPalette}>M-x</button>
 * }
 * ```
 */
export function useMinibufferActor() {
  return MinibufferReactContext.useActorRef()
}

/**
 * Subscribe to a slice of minibuffer state.
 * Only re-renders when selected value changes.
 *
 * @example
 * ```tsx
 * function CompletionsList() {
 *   const completions = useMinibufferSelector(s => s.context.completions)
 *   const selectedIndex = useMinibufferSelector(s => s.context.selectedIndex)
 *
 *   return (
 *     <ul>
 *       {completions.map((c, i) => (
 *         <li key={c.value} data-selected={i === selectedIndex}>
 *           {c.label}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useMinibufferSelector<T>(
  selector: (snapshot: MinibufferSnapshot) => T,
  compare?: (a: T, b: T) => boolean
) {
  return MinibufferReactContext.useSelector(selector, compare)
}

/**
 * Get both actor reference and full snapshot.
 * Use sparingly — prefer useMinibufferSelector for performance.
 */
export function useMinibuffer() {
  const actorRef = MinibufferReactContext.useActorRef()
  const snapshot = MinibufferReactContext.useSelector((s) => s)
  return [snapshot, actorRef.send, actorRef] as const
}

// ─────────────────────────────────────────────────────────────
// Selectors (Reusable)
// ─────────────────────────────────────────────────────────────

/** Current mode (state value) */
export const selectMode = (s: MinibufferSnapshot) => s.value as string

/** Whether minibuffer is active (not idle) */
export const selectIsActive = (s: MinibufferSnapshot) => s.value !== "idle"

/** Current prompt text */
export const selectPrompt = (s: MinibufferSnapshot) => s.context.prompt

/** Current input value */
export const selectInput = (s: MinibufferSnapshot) => s.context.input

/** Available completions */
export const selectCompletions = (s: MinibufferSnapshot) => s.context.completions

/** Selected completion index */
export const selectSelectedIndex = (s: MinibufferSnapshot) => s.context.selectedIndex

/** Currently selected completion (derived) */
export const selectSelectedCompletion = (s: MinibufferSnapshot): Completion | null =>
  s.context.completions[s.context.selectedIndex] ?? null

/** Result of last operation (for Effect stream to consume) */
export const selectResult = (s: MinibufferSnapshot) => s.context.result

/** Which-key prefix */
export const selectWhichKeyPrefix = (s: MinibufferSnapshot) => s.context.whichKeyPrefix

/** Which-key entries */
export const selectWhichKeyEntries = (s: MinibufferSnapshot) => s.context.whichKeyEntries

/** Error state */
export const selectError = (s: MinibufferSnapshot) => s.context.error
