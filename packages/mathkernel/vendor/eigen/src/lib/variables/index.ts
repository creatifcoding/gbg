/**
 * TMNL Variables
 *
 * Emacs-inspired variable system with Effect Schema validation.
 *
 * ## Overview
 *
 * Variables are named, typed, documented configuration points that can be:
 * - Read with scope resolution (editor → workspace → user → default)
 * - Set with Schema validation
 * - Customized via settings UI
 * - Persisted across sessions
 *
 * ## Usage
 *
 * ```typescript
 * // Define a variable
 * const tabWidth = defineVariable({
 *   id: 'editor.tabWidth',
 *   schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
 *   default: 4,
 *   description: 'Number of spaces per tab',
 *   group: 'editor',
 *   scope: 'editor',
 * })
 *
 * // Use in React
 * function EditorSettings() {
 *   const { value, set, isModified, reset } = useVariable('editor.tabWidth')
 *   // ...
 * }
 *
 * // Use in Effect
 * const width = yield* VariableService.get('editor.tabWidth')
 * yield* VariableService.set('editor.tabWidth', 2)
 * ```
 *
 * ## Architecture
 *
 * - **Types**: Schema-based type definitions with branded IDs
 * - **Define**: defineVariable() for registering variables
 * - **Service**: Effect.Service for get/set/describe operations
 * - **Atoms**: Scoped storage (global, workspace, editor)
 * - **Hooks**: React hooks for reactive access
 * - **Persistence**: localStorage adapter with auto-save
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  VariableId,
  WorkspaceId,
  EditorId,
  VariableScope,
  VariableGroup,
  StandardVariableGroup,
  VariableDefinition,
  VariableMetadata,
  ResolvedValue,
  ValueSource,
  VariableChangeEvent,
  VariableError,
} from './types'

export {
  VariableId as VariableIdSchema,
  WorkspaceId as WorkspaceIdSchema,
  EditorId as EditorIdSchema,
  VariableScope as VariableScopeSchema,
  VariableGroup as VariableGroupSchema,
  StandardVariableGroup as StandardVariableGroupSchema,
  VariableMetadata as VariableMetadataSchema,
  ValueSource as ValueSourceSchema,
  VariableChangeEvent as VariableChangeEventSchema,
  // Error types
  VariableNotFoundError,
  VariableValidationError,
  VariableSetterError,
  VariableAlreadyExistsError,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Define API
// ─────────────────────────────────────────────────────────────────────────────

export {
  defineVariable,
  getRegisteredVariables,
  getVariableDefinition,
  getVariableMetadata,
  getAllVariableMetadata,
  getVariableMetadataByGroup,
  getVariableGroups,
  clearVariableRegistry,
} from './define'

export type { DefineVariableOptions } from './define'

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export { VariableService } from './service'
export type { VariableServiceImpl } from './service'

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

export {
  userValuesAtom,
  workspaceValuesAtom,
  editorValuesAtom,
  currentWorkspaceIdAtom,
  currentEditorIdAtom,
  variableChangesAtom,
  setUserValue,
  removeUserValue,
  setWorkspaceValue,
  removeWorkspaceValue,
  setEditorValue,
  removeEditorValue,
  clearEditorValues,
  resolveValue,
  emitVariableChange,
} from './atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  useVariable,
  useVariableValue,
  useVariableMetadata,
  useVariableGroups,
} from './hooks/useVariable'

export type { UseVariableReturn } from './hooks/useVariable'

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

export {
  loadPersistedVariables,
  loadPersistedVariablesSync,
  savePersistedVariables,
  savePersistedVariablesSync,
  clearPersistedVariables,
  clearPersistedVariablesSync,
  setupAutoSave,
  useVariablePersistence,
  // Error types
  StorageReadError,
  StorageWriteError,
  StorageParseError,
} from './persistence'

// ─────────────────────────────────────────────────────────────────────────────
// Default Variables
// ─────────────────────────────────────────────────────────────────────────────

// Re-export editor variables for convenience
export * as editorVariables from './defaults/editor'
