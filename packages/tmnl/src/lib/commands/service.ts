/**
 * TMNL Commands — Effect Service
 *
 * Provides command execution and binding management as an Effect service.
 */

import { Context, Effect, Layer, Option } from 'effect'
import { Atom } from '@effect-atom/atom'
import type {
  Command,
  GlobalCommand,
  EntityCommand,
  CommandError,
  CommandContext,
  KeyBinding,
  KeyBindingOverride,
  KeyBindingsConfig,
  CommandScope,
} from './types'
import { getRegisteredCommands, getDefaultBindings } from './decorators'
import { MinibufferService } from '../minibuffer/services/MinibufferService'
import { COMMAND_PROVIDER_ID } from './CommandProvider'

// ─────────────────────────────────────────────────────────────────────────────
// Atoms (Reactive State)
// ─────────────────────────────────────────────────────────────────────────────

/** All registered commands */
export const commandsAtom = Atom.make<ReadonlyMap<string, Command>>(new Map())

/** User keybinding overrides */
export const bindingOverridesAtom = Atom.make<readonly KeyBindingOverride[]>([])

/** Computed effective bindings (defaults + overrides) */
export const effectiveBindingsAtom = Atom.make((get) => {
  const overrides = get(bindingOverridesAtom)
  const defaults = getDefaultBindings()

  // Build override lookup
  const overrideMap = new Map<string, KeyBindingOverride>()
  for (const override of overrides) {
    overrideMap.set(override.commandId, override)
  }

  // Apply overrides to defaults
  const effective: KeyBinding[] = []
  for (const binding of defaults) {
    const override = overrideMap.get(binding.commandId)
    if (override) {
      // null keys means unbind
      if (override.keys !== null) {
        effective.push({
          ...binding,
          keys: override.keys,
          scope: override.scope ?? binding.scope,
        })
      }
      // If keys is null, we skip (unbind)
    } else {
      effective.push(binding)
    }
  }

  return effective as readonly KeyBinding[]
})

// ─────────────────────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for executeInteractive (M-x)
 */
export interface ExecuteInteractiveOptions {
  /** Animation style for the minibuffer drawer */
  readonly animate?: 'slide' | 'none'
}

export interface CommandServiceImpl {
  /** Get a command by ID */
  readonly get: (id: string) => Effect.Effect<Option.Option<Command>>

  /** Execute a global command */
  readonly execute: (id: string) => Effect.Effect<void, CommandError>

  /** Execute an entity command with context */
  readonly executeEntity: <T>(
    id: string,
    entity: T,
    ctx?: Partial<CommandContext<T>>
  ) => Effect.Effect<void, CommandError>

  /**
   * Execute interactive command selection (M-x).
   *
   * Opens the minibuffer with command completions, waits for user selection,
   * then executes the selected command.
   *
   * This is the canonical M-x implementation. Hotkeys should call this,
   * NOT call minibuffer directly.
   *
   * @param options - Animation and display options
   * @returns Effect that completes when command finishes (or is cancelled)
   */
  readonly executeInteractive: (options?: ExecuteInteractiveOptions) => Effect.Effect<void>

  /** List all commands */
  readonly list: () => Effect.Effect<readonly Command[]>

  /** List commands by scope */
  readonly listByScope: (scope: CommandScope) => Effect.Effect<readonly Command[]>

  /** Get effective keybindings */
  readonly getBindings: () => Effect.Effect<readonly KeyBinding[]>

  /** Override a keybinding */
  readonly overrideBinding: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    commandId: string,
    keys: string | null,
    scope?: CommandScope
  ) => Effect.Effect<void>

  /** Reset a keybinding to default */
  readonly resetBinding: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    commandId: string
  ) => Effect.Effect<void>

  /** Reset all keybindings to defaults */
  readonly resetAllBindings: (
    registry: { set: <A>(atom: Atom.Writable<A, A>, value: A) => void }
  ) => Effect.Effect<void>
}

export class CommandService extends Context.Tag('tmnl/commands/CommandService')<
  CommandService,
  CommandServiceImpl
>() {
  static Default = Layer.succeed(
    this,
    CommandService.of({
      get: (id) =>
        Effect.sync(() => {
          const commands = getRegisteredCommands()
          return Option.fromNullable(commands.get(id))
        }),

      execute: (id) =>
        Effect.gen(function* () {
          const commands = getRegisteredCommands()
          const command = commands.get(id)

          if (!command) {
            return yield* Effect.fail({ _tag: 'NotFound', commandId: id } as CommandError)
          }

          if (command.type !== 'global') {
            return yield* Effect.fail({
              _tag: 'InvalidContext',
              reason: `Command ${id} requires an entity context`,
            } as CommandError)
          }

          yield* (command as GlobalCommand).execute
        }),

      executeEntity: <T>(id: string, entity: T, ctx?: Partial<CommandContext<T>>) =>
        Effect.gen(function* () {
          const commands = getRegisteredCommands()
          const command = commands.get(id)

          if (!command) {
            return yield* Effect.fail({ _tag: 'NotFound', commandId: id } as CommandError)
          }

          if (command.type !== 'entity') {
            return yield* Effect.fail({
              _tag: 'InvalidContext',
              reason: `Command ${id} is not an entity command`,
            } as CommandError)
          }

          const fullCtx: CommandContext<T> = {
            scope: ctx?.scope ?? command.scope,
            entity,
            args: ctx?.args,
          }

          yield* (command as EntityCommand<T>).execute(entity, fullCtx)
        }),

      executeInteractive: (_options) =>
        Effect.gen(function* () {
          // Use MinibufferService.read() with CommandProvider
          const minibuffer = yield* MinibufferService
          const selectedId = yield* minibuffer.read('M-x ', COMMAND_PROVIDER_ID, {
            requireSelection: true,
          })

          // Execute the selected command (if not cancelled)
          if (selectedId) {
            const commands = getRegisteredCommands()
            const command = commands.get(selectedId)

            if (!command) {
              yield* Effect.logWarning(`Command not found: ${selectedId}`)
              return
            }

            if (command.type === 'global') {
              yield* Effect.logInfo(`Executing command: ${selectedId}`)
              yield* (command as GlobalCommand).execute.pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`Command failed: ${JSON.stringify(error)}`)
                )
              )
            } else {
              yield* Effect.logWarning(`Entity command ${selectedId} requires context`)
            }
          }
        }).pipe(
          // Provide MinibufferService for standalone execution
          Effect.provide(MinibufferService.Default)
        ),

      list: () =>
        Effect.sync(() => Array.from(getRegisteredCommands().values())),

      listByScope: (scope) =>
        Effect.sync(() =>
          Array.from(getRegisteredCommands().values()).filter((c) => c.scope === scope)
        ),

      getBindings: () =>
        Effect.sync(() => getDefaultBindings()),

      overrideBinding: (registry, commandId, keys, scope) =>
        Effect.sync(() => {
          const prev = registry.get(bindingOverridesAtom)
          const filtered = prev.filter((o) => o.commandId !== commandId)
          const override: KeyBindingOverride = { commandId, keys, scope }
          registry.set(bindingOverridesAtom, [...filtered, override])
        }),

      resetBinding: (registry, commandId) =>
        Effect.sync(() => {
          const prev = registry.get(bindingOverridesAtom)
          registry.set(
            bindingOverridesAtom,
            prev.filter((o) => o.commandId !== commandId)
          )
        }),

      resetAllBindings: (registry) =>
        Effect.sync(() => {
          registry.set(bindingOverridesAtom, [])
        }),
    })
  )
}
