/**
 * TMNL Commands — Hotkey Wire
 *
 * Bridges the command system (src/lib/commands) with the hotkey system (src/lib/hotkeys).
 *
 * Call `wireCommands(registry)` at app initialization to register all commands
 * and their default keybindings with the hotkey system.
 */

import { Effect, Option } from 'effect'
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
  readonly errors: readonly { commandId: string; error: string }[]
}

/**
 * Registry interface needed for wiring.
 */
export interface RegistryLike {
  get: <A>(atom: Atom.Atom<A>) => A
  set: <A>(atom: Atom.Writable<A, A>, value: A) => void
}

/**
 * Wire all commands and keybindings from the command system to the hotkey system.
 *
 * @param registry - The effect-atom registry (from RegistryContext)
 * @returns Result with counts and any errors
 *
 * @example
 * ```tsx
 * import { useContext, useEffect } from 'react'
 * import { RegistryContext } from '@effect-atom/atom-react'
 * import { wireCommands } from '@/lib/commands/wire'
 *
 * function App() {
 *   const registry = useContext(RegistryContext)
 *
 *   useEffect(() => {
 *     const result = wireCommands(registry)
 *     console.log(`Wired ${result.commandsRegistered} commands, ${result.bindingsRegistered} bindings`)
 *   }, [registry])
 *
 *   return <YourApp />
 * }
 * ```
 */
export function wireCommands(registry: RegistryLike): WireResult {
  const commands = getRegisteredCommands()
  const bindings = getDefaultBindings()
  const errors: { commandId: string; error: string }[] = []

  let commandsRegistered = 0
  let bindingsRegistered = 0

  // Register all commands
  for (const [id, cmd] of commands) {
    try {
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
      commandsRegistered++
    } catch (e) {
      errors.push({
        commandId: id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Register all keybindings
  // We need to parse key strings to KeySequence, which requires Effect
  for (const binding of bindings) {
    try {
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
      bindingsRegistered++
    } catch (e) {
      errors.push({
        commandId: binding.commandId,
        error: `Failed to parse keys "${binding.keys}": ${e instanceof Error ? e.message : String(e)}`,
      })
    }
  }

  return { commandsRegistered, bindingsRegistered, errors }
}

/**
 * Wire commands as an Effect (for use in Effect pipelines).
 */
export const wireCommandsEffect = (registry: RegistryLike): Effect.Effect<WireResult> =>
  Effect.sync(() => wireCommands(registry))

/**
 * Clear all commands and bindings from the hotkey system.
 * Useful for testing or reloading.
 */
export function unwireCommands(registry: RegistryLike): void {
  registry.set(commandsSourceAtom, new Map())
  registry.set(bindingsSourceAtom, [])
}
