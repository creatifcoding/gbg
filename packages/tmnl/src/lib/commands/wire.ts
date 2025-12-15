/**
 * TMNL Commands — Hotkey Wire
 *
 * Bridges the command system (src/lib/commands) with the hotkey system (src/lib/hotkeys).
 *
 * Call `wireCommandsEffect(registry)` at app initialization to register all commands
 * and their default keybindings with the hotkey system.
 *
 * ERROR HANDLING:
 * Uses Effect for error handling. Wiring errors are accumulated (not fail-fast)
 * so partial wiring is possible. Use `WireError` tagged errors for specific handling.
 */

import { Effect, Data, Ref, Array as A } from 'effect'
import { Atom } from '@effect-atom/atom'
import { getRegisteredCommands, getDefaultBindings } from './decorators'
import type { GlobalCommand, EntityCommand, Command } from './types'
import {
  hotkeyActions,
  hotkeyOps,
  hotkeyRuntimeAtom,
  commandsSourceAtom,
  bindingsSourceAtom,
  type Binding,
  type Command as HotkeyCommand,
  type CommandConfig,
  type ScopeId,
  Scopes,
} from '../hotkeys'

// ─────────────────────────────────────────────────────────────────────────────
// Error Types (Tagged for Effect.catchTag)
// ─────────────────────────────────────────────────────────────────────────────

/** Error during command registration */
export class CommandRegistrationError extends Data.TaggedError('CommandRegistrationError')<{
  readonly commandId: string
  readonly cause: unknown
}> {}

/** Error during keybinding parsing/registration */
export class BindingRegistrationError extends Data.TaggedError('BindingRegistrationError')<{
  readonly commandId: string
  readonly keys: string
  readonly cause: unknown
}> {}

/** Aggregate of all wiring errors (non-fatal, accumulated) */
export class WireError extends Data.TaggedError('WireError')<{
  readonly errors: readonly (CommandRegistrationError | BindingRegistrationError)[]
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Type Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps command system scope to hotkey system scope.
 * Both use the same string IDs, so this is identity + validation.
 */
function mapScope(scope: string): ScopeId {
  const validScopes = Object.values(Scopes) as string[]
  if (validScopes.includes(scope)) {
    return scope as ScopeId
  }
  // Default to global for unknown scopes
  return Scopes.GLOBAL
}

/**
 * Adapts a command from the command system to the hotkey system.
 */
function adaptCommandToHotkey(cmd: Command): HotkeyCommand {
  // For global commands, use execute directly
  // For entity commands, wrap in a handler that logs (entity commands need special handling)
  const handler =
    cmd.type === 'global'
      ? (cmd as GlobalCommand).execute
      : Effect.gen(function* () {
          yield* Effect.log(`Entity command ${cmd.id} triggered - requires entity context`)
        })

  return {
    id: cmd.id,
    name: cmd.name,
    description: cmd.description,
    category: cmd.category,
    icon: cmd.icon,
    handler,
    // Note: cmd.when is a string expression (future: monaco-style)
    // The hotkey system expects a function. For now, skip conversion.
    // TODO: Implement when-expression evaluator
    when: undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire Function
// ─────────────────────────────────────────────────────────────────────────────

export interface WireResult {
  readonly commandsRegistered: number
  readonly bindingsRegistered: number
  readonly errors: readonly (CommandRegistrationError | BindingRegistrationError)[]
}

/**
 * Registry interface needed for wiring.
 */
export interface RegistryLike {
  get: <A>(atom: Atom.Atom<A>) => A
  set: <A>(atom: Atom.Writable<A, A>, value: A) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect-Based Wiring (Primary API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a single command with the hotkey system.
 * Returns the command ID on success.
 */
const registerSingleCommand = (
  registry: RegistryLike,
  id: string,
  cmd: Command
): Effect.Effect<string, CommandRegistrationError> =>
  Effect.try({
    try: () => {
      const hotkeyCmd = adaptCommandToHotkey(cmd)
      hotkeyActions.registerCommand(
        registry,
        {
          id: hotkeyCmd.id,
          name: hotkeyCmd.name,
          description: hotkeyCmd.description,
          category: hotkeyCmd.category,
          icon: hotkeyCmd.icon,
          when: hotkeyCmd.when,
        },
        hotkeyCmd.handler
      )
      return id
    },
    catch: (cause) => new CommandRegistrationError({ commandId: id, cause }),
  })

/**
 * Register a single keybinding with the hotkey system.
 * Returns the command ID on success.
 */
const registerSingleBinding = (
  registry: RegistryLike,
  binding: { keys: string; commandId: string; scope: string }
): Effect.Effect<string, BindingRegistrationError> =>
  Effect.try({
    try: () => {
      // Use the runtime atom to parse keys
      const parseEffect = hotkeyOps.parseKeys(binding.keys)
      const parsedKeys = registry.get(hotkeyRuntimeAtom.atom(parseEffect))

      // Create the binding with parsed keys
      const hotkeyBinding: Binding = {
        keys: parsedKeys,
        commandId: binding.commandId,
        scope: mapScope(binding.scope),
        priority: 0,
        source: 'default',
        description: undefined,
      }

      hotkeyActions.addBinding(registry, hotkeyBinding)
      return binding.commandId
    },
    catch: (cause) =>
      new BindingRegistrationError({
        commandId: binding.commandId,
        keys: binding.keys,
        cause,
      }),
  })

/**
 * Wire all commands and keybindings from the command system to the hotkey system.
 *
 * Uses Effect for error handling with accumulated errors (non-fail-fast).
 * Partial wiring is possible — errors don't stop the process.
 *
 * @param registry - The effect-atom registry (from RegistryContext)
 * @returns Effect yielding WireResult with counts and accumulated errors
 *
 * @example
 * ```tsx
 * import { useContext, useEffect } from 'react'
 * import { RegistryContext } from '@effect-atom/atom-react'
 * import { wireCommandsEffect } from '@/lib/commands/wire'
 *
 * function App() {
 *   const registry = useContext(RegistryContext)
 *
 *   useEffect(() => {
 *     Effect.runPromise(
 *       wireCommandsEffect(registry).pipe(
 *         Effect.tap((result) =>
 *           Effect.log(`Wired ${result.commandsRegistered} commands, ${result.bindingsRegistered} bindings`)
 *         )
 *       )
 *     )
 *   }, [registry])
 *
 *   return <YourApp />
 * }
 * ```
 */
export const wireCommandsEffect = (registry: RegistryLike): Effect.Effect<WireResult> =>
  Effect.gen(function* () {
    const commands = getRegisteredCommands()
    const bindings = getDefaultBindings()

    // Use Ref to accumulate errors without fail-fast
    const errorsRef = yield* Ref.make<(CommandRegistrationError | BindingRegistrationError)[]>([])
    const commandCountRef = yield* Ref.make(0)
    const bindingCountRef = yield* Ref.make(0)

    // Register all commands (accumulate errors)
    for (const [id, cmd] of commands) {
      yield* registerSingleCommand(registry, id, cmd).pipe(
        Effect.tap(() => Ref.update(commandCountRef, (n) => n + 1)),
        Effect.catchAll((err) =>
          Ref.update(errorsRef, (errs) => [...errs, err])
        )
      )
    }

    // Register all keybindings (accumulate errors)
    for (const binding of bindings) {
      yield* registerSingleBinding(registry, binding).pipe(
        Effect.tap(() => Ref.update(bindingCountRef, (n) => n + 1)),
        Effect.catchAll((err) =>
          Ref.update(errorsRef, (errs) => [...errs, err])
        )
      )
    }

    const errors = yield* Ref.get(errorsRef)
    const commandsRegistered = yield* Ref.get(commandCountRef)
    const bindingsRegistered = yield* Ref.get(bindingCountRef)

    // Log if there were errors
    if (errors.length > 0) {
      yield* Effect.logWarning(`Wire completed with ${errors.length} errors`)
    }

    return { commandsRegistered, bindingsRegistered, errors }
  })

/**
 * Wire commands synchronously (convenience wrapper).
 *
 * DEPRECATED: Prefer `wireCommandsEffect` for proper error handling.
 * This wrapper uses Effect.runSync which will throw on async operations.
 *
 * @param registry - The effect-atom registry
 * @returns WireResult
 */
export function wireCommands(registry: RegistryLike): WireResult {
  return Effect.runSync(wireCommandsEffect(registry))
}

/**
 * Clear all commands and bindings from the hotkey system.
 * Returns Effect for composition.
 */
export const unwireCommandsEffect = (registry: RegistryLike): Effect.Effect<void> =>
  Effect.sync(() => {
    registry.set(commandsSourceAtom, new Map())
    registry.set(bindingsSourceAtom, [])
  })

/**
 * Clear all commands and bindings from the hotkey system.
 * Synchronous convenience wrapper.
 */
export function unwireCommands(registry: RegistryLike): void {
  Effect.runSync(unwireCommandsEffect(registry))
}
