/**
 * TMNL Commands — Decorator DSL
 *
 * Usage:
 * ```ts
 * @command({
 *   id: 'file.save',
 *   name: 'Save',
 *   category: 'file',
 *   scope: 'global',
 *   keys: 'ctrl+s',
 * })
 * class SaveCommand {
 *   execute = Effect.gen(function* () {
 *     yield* Console.log('Saving...')
 *   })
 * }
 * ```
 */

import { Effect } from 'effect'
import type {
  CommandMeta,
  CommandScope,
  CommandCategory,
  CommandError,
  GlobalCommand,
  EntityCommand,
  KeyBinding,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Decorator Options
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandOptions extends Omit<CommandMeta, 'id'> {
  readonly id: string
  readonly keys?: string // Default keybinding
}

export interface EntityCommandOptions<TEntity> extends CommandOptions {
  readonly entityType: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Registry (collected at module load)
// ─────────────────────────────────────────────────────────────────────────────

const registeredCommands: Map<string, GlobalCommand | EntityCommand> = new Map()
const defaultBindings: KeyBinding[] = []

/** Get all registered commands */
export function getRegisteredCommands(): ReadonlyMap<string, GlobalCommand | EntityCommand> {
  return registeredCommands
}

/** Get default keybindings */
export function getDefaultBindings(): readonly KeyBinding[] {
  return defaultBindings
}

/** Clear registry (for testing) */
export function clearRegistry(): void {
  registeredCommands.clear()
  defaultBindings.length = 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Class Decorators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decorator for global commands (no entity context)
 *
 * The class must have an `execute` property that is an Effect.
 */
export function command(options: CommandOptions) {
  return function <T extends { new (...args: unknown[]): { execute: Effect.Effect<void, CommandError> } }>(
    target: T
  ): T {
    const instance = new target()

    const cmd: GlobalCommand = {
      type: 'global',
      id: options.id,
      name: options.name,
      description: options.description,
      category: options.category,
      scope: options.scope,
      icon: options.icon,
      when: options.when,
      execute: instance.execute,
    }

    registeredCommands.set(options.id, cmd)

    // Register default binding if keys provided
    if (options.keys) {
      defaultBindings.push({
        keys: options.keys,
        commandId: options.id,
        scope: options.scope,
        when: options.when,
      })
    }

    return target
  }
}

/**
 * Decorator for entity commands (require target entity)
 *
 * The class must have an `execute` method that takes (entity, context).
 */
export function entityCommand<TEntity>(options: EntityCommandOptions<TEntity>) {
  return function <
    T extends {
      new (...args: unknown[]): {
        execute: (entity: TEntity, ctx: { scope: CommandScope; entity?: TEntity; args?: Record<string, unknown> }) => Effect.Effect<void, CommandError>
      }
    }
  >(target: T): T {
    const instance = new target()

    const cmd: EntityCommand<TEntity> = {
      type: 'entity',
      id: options.id,
      name: options.name,
      description: options.description,
      category: options.category,
      scope: options.scope,
      icon: options.icon,
      when: options.when,
      entityType: options.entityType,
      execute: instance.execute.bind(instance),
    }

    registeredCommands.set(options.id, cmd as EntityCommand)

    // Register default binding if keys provided
    if (options.keys) {
      defaultBindings.push({
        keys: options.keys,
        commandId: options.id,
        scope: options.scope,
        when: options.when,
      })
    }

    return target
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Functional API (alternative to decorators)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Define a global command without decorators
 */
export function defineCommand(
  options: CommandOptions,
  execute: Effect.Effect<void, CommandError>
): GlobalCommand {
  const cmd: GlobalCommand = {
    type: 'global',
    id: options.id,
    name: options.name,
    description: options.description,
    category: options.category,
    scope: options.scope,
    icon: options.icon,
    when: options.when,
    execute,
  }

  registeredCommands.set(options.id, cmd)

  if (options.keys) {
    defaultBindings.push({
      keys: options.keys,
      commandId: options.id,
      scope: options.scope,
      when: options.when,
    })
  }

  return cmd
}

/**
 * Define an additional key binding for an existing command.
 *
 * Use this to add alternative bindings (e.g., Alt+X for command palette in addition to Ctrl+Shift+P).
 */
export function defineBinding(
  keys: string,
  commandId: string,
  scope: CommandScope,
  when?: string
): KeyBinding {
  const binding: KeyBinding = {
    keys,
    commandId,
    scope,
    when,
  }
  defaultBindings.push(binding)
  return binding
}

/**
 * Define an entity command without decorators
 */
export function defineEntityCommand<TEntity>(
  options: EntityCommandOptions<TEntity>,
  execute: (entity: TEntity, ctx: { scope: CommandScope; entity?: TEntity; args?: Record<string, unknown> }) => Effect.Effect<void, CommandError>
): EntityCommand<TEntity> {
  const cmd: EntityCommand<TEntity> = {
    type: 'entity',
    id: options.id,
    name: options.name,
    description: options.description,
    category: options.category,
    scope: options.scope,
    icon: options.icon,
    when: options.when,
    entityType: options.entityType,
    execute,
  }

  registeredCommands.set(options.id, cmd as EntityCommand)

  if (options.keys) {
    defaultBindings.push({
      keys: options.keys,
      commandId: options.id,
      scope: options.scope,
      when: options.when,
    })
  }

  return cmd
}
