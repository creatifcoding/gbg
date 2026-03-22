/**
 * Minibuffer v2 — Command Execution Stream
 *
 * Effect stream that watches resultAtom and executes commands.
 *
 * Pattern: Atom.toStream → filter → execute → clear
 * - Subscribes to resultAtom via Atom.toStream
 * - Filters for "selected" results (command mode completions)
 * - Executes command via provided handler
 * - Clears result after execution
 *
 * This is the "drain" mechanism: UI collects values, Effect consumes them.
 *
 * @module
 */

import { Effect, Stream, Fiber, Scope } from "effect"
import { Atom, Registry as AtomRegistry } from "@effect-atom/atom"
import { resultAtom, ops } from "./atoms"
import type { MinibufferResult, Completion } from "./machine"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of a command execution.
 */
export interface CommandExecutionResult {
  readonly commandId: string
  readonly completion: Completion
  readonly success: boolean
  readonly error?: unknown
}

/**
 * Handler for executing commands.
 * Receives the command ID and completion, returns an Effect.
 */
export type CommandHandler = (
  commandId: string,
  completion: Completion
) => Effect.Effect<void, unknown, never>

// ============================================================================
// EXECUTION STREAM
// ============================================================================

/**
 * Creates a stream that watches for command selections and executes them.
 *
 * @param handler - Function to execute when a command is selected
 * @returns Stream that emits execution results
 *
 * @example
 * ```typescript
 * const stream = createExecutionStream((commandId, completion) =>
 *   Effect.gen(function* () {
 *     const command = yield* lookupCommand(commandId)
 *     yield* command.execute()
 *   })
 * )
 *
 * // Run the stream (usually in a long-running fiber)
 * Effect.runFork(
 *   stream.pipe(
 *     Stream.runForEach((result) =>
 *       Effect.log(`Executed ${result.commandId}: ${result.success}`)
 *     )
 *   )
 * )
 * ```
 */
export const createExecutionStream = (
  handler: CommandHandler
) =>
  Atom.toStream(resultAtom).pipe(
    // Filter for selected results with completions
    Stream.filter(
      (result): result is MinibufferResult & { type: "selected"; completion: Completion } =>
        result !== null &&
        result.type === "selected" &&
        "completion" in result &&
        result.completion !== undefined
    ),
    // Execute command and clear result
    Stream.mapEffect((result) =>
      Effect.gen(function* () {
        const commandId = result.value
        const completion = result.completion

        // Execute the command
        const executionResult = yield* handler(commandId, completion).pipe(
          Effect.map(() => ({
            commandId,
            completion,
            success: true as const,
          })),
          Effect.catchAll((error) =>
            Effect.succeed({
              commandId,
              completion,
              success: false as const,
              error,
            })
          )
        )

        // Clear the result after execution
        ops.clearResult()

        return executionResult
      })
    )
  )

/**
 * Run the execution stream with a command handler.
 *
 * Returns an Effect that runs the stream indefinitely.
 * Use Effect.fork to run in background, Fiber.interrupt to stop.
 *
 * @param handler - Function to execute commands
 * @returns Effect that runs the stream
 *
 * @example
 * ```typescript
 * // Start execution stream in background
 * const fiber = yield* Effect.fork(
 *   runExecutionStream((commandId) =>
 *     Effect.log(`Executing: ${commandId}`)
 *   )
 * )
 *
 * // Later: stop the stream
 * yield* Fiber.interrupt(fiber)
 * ```
 */
export const runExecutionStream = (
  handler: CommandHandler
) =>
  createExecutionStream(handler).pipe(Stream.runDrain)

/**
 * Create a scoped execution stream that cleans up on scope close.
 *
 * @param handler - Function to execute commands
 * @returns Scoped Effect that runs the stream
 */
export const scopedExecutionStream = (
  handler: CommandHandler
) =>
  Effect.acquireRelease(
    Effect.fork(runExecutionStream(handler)),
    (fiber) => Effect.asVoid(Fiber.interrupt(fiber))
  ).pipe(Effect.asVoid)

// ============================================================================
// SIMPLE POLLING EXECUTOR
// ============================================================================

/**
 * Simple polling executor for synchronous contexts.
 *
 * Checks resultAtom, executes if "selected", clears result.
 * Use when you need immediate execution without stream setup.
 *
 * @param handler - Sync function to execute command
 * @returns true if a command was executed, false otherwise
 *
 * @example
 * ```typescript
 * // In a React effect or event handler
 * useEffect(() => {
 *   const executed = pollAndExecute((commandId) => {
 *     console.log(`Executing: ${commandId}`)
 *   })
 *   if (executed) {
 *     console.log("Command executed")
 *   }
 * }, [result])
 * ```
 */
export const pollAndExecute = (
  handler: (commandId: string, completion: Completion) => void,
  registry: AtomRegistry.Registry
): boolean => {
  const result = registry.get(resultAtom)

  if (result !== null && result.type === "selected" && "completion" in result) {
    handler(result.value, result.completion as Completion)
    ops.clearResult()
    return true
  }

  return false
}
