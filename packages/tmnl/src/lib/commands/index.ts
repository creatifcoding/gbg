/**
 * TMNL Commands
 *
 * Effect-native command system with decorator DSL.
 *
 * ## Architecture
 *
 * - **Types**: Core command and binding types
 * - **Decorators**: @command / @entityCommand DSL, plus functional API
 * - **Defaults**: All built-in commands with default keybindings
 * - **Service**: Effect service for execution and binding management
 *
 * ## Usage
 *
 * ```ts
 * // Define a command (functional style)
 * import { defineCommand } from '@/lib/commands'
 *
 * const myCommand = defineCommand({
 *   id: 'my.command',
 *   name: 'My Command',
 *   category: 'system',
 *   scope: 'global',
 *   keys: 'ctrl+m',
 * }, Effect.gen(function* () {
 *   yield* Effect.log('Executing...')
 * }))
 *
 * // Execute via service
 * const result = yield* CommandService.execute('my.command')
 *
 * // Override keybinding
 * CommandService.overrideBinding(registry, 'my.command', 'ctrl+shift+m')
 * ```
 *
 * ## Command Types
 *
 * - **Global**: No entity context required (save, open, palette)
 * - **Entity**: Requires target entity (delete row, format selection)
 */

// Types
export type {
  CommandScope,
  CommandCategory,
  CommandMeta,
  KeyBinding,
  CommandContext,
  CommandError,
  GlobalCommand,
  EntityCommand,
  Command,
  KeyBindingOverride,
  KeyBindingsConfig,
  CommandRegistryState,
} from './types'

// Decorators & functional API
export {
  command,
  entityCommand,
  defineCommand,
  defineEntityCommand,
  getRegisteredCommands,
  getDefaultBindings,
  clearRegistry,
} from './decorators'

export type { CommandOptions, EntityCommandOptions } from './decorators'

// Service
export {
  CommandService,
  commandsAtom,
  bindingOverridesAtom,
  effectiveBindingsAtom,
} from './service'

// Default commands (import for side-effect registration)
export { allCommands } from './defaults'

// Re-export specific commands for direct access
export {
  // File
  saveCommand,
  openCommand,
  newFileCommand,
  // System
  commandPaletteCommand,
  settingsCommand,
  keyboardShortcutsCommand,
  // Navigation
  goToTopCommand,
  goToBottomCommand,
  goToInboxCommand,
  goToStarredCommand,
  // Editor
  formatDocumentCommand,
  toggleCommentCommand,
  undoCommand,
  redoCommand,
  findCommand,
  replaceCommand,
  // Grid
  gridAddRowCommand,
  gridDeleteRowCommand,
  gridDuplicateRowCommand,
  // tldraw
  tldrawSelectAllCommand,
  tldrawDeleteCommand,
  tldrawZoomInCommand,
  tldrawZoomOutCommand,
  tldrawZoomFitCommand,
} from './defaults'

// Wiring (connects command system to hotkey system)
export {
  wireCommands,
  wireCommandsEffect,
  unwireCommands,
} from './wire'
export type { WireResult, RegistryLike } from './wire'

// React hook for wiring
export { useCommandWire, withCommandWire } from './useCommandWire'
export type { UseCommandWireOptions, UseCommandWireResult } from './useCommandWire'

// Persistence
export {
  useKeybindingPersistence,
  loadOverrides,
  saveOverrides,
  clearPersistedOverrides,
} from './persistence'
export type {
  UseKeybindingPersistenceOptions,
  UseKeybindingPersistenceResult,
} from './persistence'
