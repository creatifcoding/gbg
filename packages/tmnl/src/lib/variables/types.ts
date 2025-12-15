/**
 * TMNL Variables — Type Definitions
 *
 * Effect Schema-based type system for the variables system.
 * Follows Emacs defvar/defcustom patterns with modern type safety.
 */

import { Schema, Effect, Data } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable identifier — branded string for type safety.
 * Format: "group.name" (e.g., "editor.tabWidth", "ui.theme")
 */
export const VariableId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/),
  Schema.brand('VariableId')
)
export type VariableId = typeof VariableId.Type

/**
 * Workspace identifier — for workspace-scoped variables.
 */
export const WorkspaceId = Schema.String.pipe(Schema.brand('WorkspaceId'))
export type WorkspaceId = typeof WorkspaceId.Type

/**
 * Editor identifier — for editor-scoped (buffer-local) variables.
 */
export const EditorId = Schema.String.pipe(Schema.brand('EditorId'))
export type EditorId = typeof EditorId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Variable Scope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable scope determines where values can be overridden.
 *
 * - global: Single value across entire application
 * - workspace: Can have different values per workspace
 * - editor: Can have different values per editor (buffer-local)
 */
export const VariableScope = Schema.Literal('global', 'workspace', 'editor')
export type VariableScope = typeof VariableScope.Type

// ─────────────────────────────────────────────────────────────────────────────
// Variable Groups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard variable groups for organization.
 * Extensible — custom groups are allowed.
 */
export const StandardVariableGroup = Schema.Literal(
  'editor',
  'appearance',
  'keybindings',
  'extensions',
  'debug',
  'system'
)
export type StandardVariableGroup = typeof StandardVariableGroup.Type

/**
 * Variable group — either standard or custom string.
 */
export const VariableGroup = Schema.Union(
  StandardVariableGroup,
  Schema.String.pipe(Schema.minLength(1))
)
export type VariableGroup = typeof VariableGroup.Type

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/** Variable not found */
export class VariableNotFoundError extends Data.TaggedError('VariableNotFoundError')<{
  readonly variableId: string
}> {}

/** Variable validation failed */
export class VariableValidationError extends Data.TaggedError('VariableValidationError')<{
  readonly variableId: string
  readonly value: unknown
  readonly cause: unknown
}> {}

/** Variable setter failed */
export class VariableSetterError extends Data.TaggedError('VariableSetterError')<{
  readonly variableId: string
  readonly cause: unknown
}> {}

/** Variable already registered */
export class VariableAlreadyExistsError extends Data.TaggedError('VariableAlreadyExistsError')<{
  readonly variableId: string
}> {}

/** Union of all variable errors */
export type VariableError =
  | VariableNotFoundError
  | VariableValidationError
  | VariableSetterError
  | VariableAlreadyExistsError

// ─────────────────────────────────────────────────────────────────────────────
// Variable Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable definition — the complete specification of a variable.
 *
 * @template A - The value type
 *
 * Follows Emacs defcustom pattern:
 * - id: Unique identifier (like symbol name)
 * - schema: Type specification (like :type)
 * - default: Initial value (like INITVALUE)
 * - description: Documentation (like docstring)
 * - group: Category (like :group)
 * - scope: Where overrides are allowed
 * - setter: Custom setter function (like :set)
 * - safe: Safe for file-local binding (like :safe)
 * - customize: Show in settings UI (like defcustom vs defvar)
 */
export interface VariableDefinition<A = unknown> {
  /** Unique variable identifier */
  readonly id: VariableId

  /** Effect Schema for value validation */
  readonly schema: Schema.Schema<A, unknown>

  /** Default value (must pass schema validation) */
  readonly default: A

  /** Human-readable description */
  readonly description: string

  /** Category for organization in settings UI */
  readonly group: VariableGroup

  /** Scope determines where values can be overridden */
  readonly scope: VariableScope

  /**
   * Custom setter function.
   * Called after validation, before storage.
   * Use for side effects (apply theme, update UI, etc.)
   */
  readonly setter?: (value: A) => Effect.Effect<void, VariableSetterError>

  /**
   * Safe for file-local binding.
   * If true, this variable can be set via file-local variables.
   * If false, file-local settings are ignored for security.
   */
  readonly safe: boolean

  /**
   * Show in settings UI.
   * If true, this is a user-facing option (like defcustom).
   * If false, this is an internal variable (like defvar).
   */
  readonly customize: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Variable Metadata (for introspection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable metadata — runtime-inspectable information about a variable.
 * Used by settings UI, documentation, etc.
 */
export const VariableMetadata = Schema.Struct({
  /** Variable identifier */
  id: Schema.String,

  /** Human-readable description */
  description: Schema.String,

  /** Category group */
  group: Schema.String,

  /** Scope type */
  scope: VariableScope,

  /** Safe for file-local binding */
  safe: Schema.Boolean,

  /** Show in settings UI */
  customize: Schema.Boolean,

  /** Schema type description (for UI hints) */
  typeDescription: Schema.String,

  /** Whether variable has a custom setter */
  hasSetter: Schema.Boolean,
})
export type VariableMetadata = typeof VariableMetadata.Type

// ─────────────────────────────────────────────────────────────────────────────
// Variable Value with Source
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Value source — where the current value came from.
 */
export const ValueSource = Schema.Literal(
  'default', // From variable definition
  'user', // User customization (persisted)
  'workspace', // Workspace-specific override
  'editor', // Editor-local override
  'file' // File-local variable (future)
)
export type ValueSource = typeof ValueSource.Type

/**
 * Resolved variable value with provenance.
 */
export interface ResolvedValue<A> {
  /** The current value */
  readonly value: A

  /** Where this value came from */
  readonly source: ValueSource

  /** Whether value differs from default */
  readonly isModified: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Variable Change Event
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable change event — emitted when a variable's value changes.
 */
export const VariableChangeEvent = Schema.Struct({
  /** Variable that changed */
  variableId: Schema.String,

  /** Previous value */
  oldValue: Schema.Unknown,

  /** New value */
  newValue: Schema.Unknown,

  /** Source of the change */
  source: ValueSource,

  /** Timestamp */
  timestamp: Schema.DateFromSelf,
})
export type VariableChangeEvent = typeof VariableChangeEvent.Type
