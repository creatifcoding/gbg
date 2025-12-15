/**
 * TMNL Variables v2
 *
 * Emacs-inspired variable system with:
 * - Runtime access by string ID (no imports needed)
 * - defuFn-powered scope resolution (editor → workspace → user → default)
 * - Option-based returns for unknown variables
 * - Effect Schema validation
 * - React hooks for reactive access
 *
 * ## Quick Start
 *
 * ```typescript
 * // 1. Define variables in config.ts (loaded at startup)
 * import { Variable } from '@/lib/variables/v2'
 *
 * Variable.define({
 *   id: 'editor.tabWidth',
 *   schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
 *   default: 4,
 *   description: 'Number of spaces per tab',
 * })
 *
 * // 2. Access anywhere by string ID (no import needed!)
 * const tabWidth = yield* Variable.get('editor.tabWidth')
 * // → Option.some(4)
 *
 * // 3. Use in React
 * const { value, set, reset } = useVariable('editor.tabWidth')
 * ```
 *
 * ## defuFn Computed Defaults
 *
 * Variables can have computed defaults that derive from lower scopes:
 *
 * ```typescript
 * Variable.define({
 *   id: 'editor.lineHeight',
 *   schema: Schema.Number,
 *   default: (fontSize) => fontSize * 1.5, // Computed from lower scope
 *   description: 'Line height based on font size',
 * })
 * ```
 *
 * ## Scope Resolution
 *
 * Values resolve in this order (highest priority first):
 * 1. **editor** — Buffer-local values (per-editor)
 * 2. **workspace** — Project-specific values
 * 3. **user** — User customizations (persisted)
 * 4. **default** — From variable definition
 *
 * ## Architecture
 *
 * - **Variable** — Define and access variables
 * - **VariableProvider** — Load values from sources (map, object, defuFn)
 * - **hooks** — React integration (useVariable, useVariableValue)
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────────────────
// Variable Module
// ─────────────────────────────────────────────────────────────────────────────

export * as Variable from './Variable'

// ─────────────────────────────────────────────────────────────────────────────
// VariableProvider Module
// ─────────────────────────────────────────────────────────────────────────────

export * as VariableProvider from './VariableProvider'

// ─────────────────────────────────────────────────────────────────────────────
// React Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  useVariable,
  useVariableValue,
  useVariableValueAs,
  useVariableGroups,
  useVariableList,
  useVariablePersistence,
  useEditorContext,
  useWorkspaceContext,
  type UseVariableReturn,
} from './hooks'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  VariableDef,
  VariableError,
  ValueSource,
  ResolvedValue,
  WorkspaceId,
  EditorId,
} from './Variable'

// VariableProvider type is available via the VariableProvider namespace export

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

export {
  VariableMissingError,
  VariableValidationError,
  VariableOrError,
} from './Variable'
