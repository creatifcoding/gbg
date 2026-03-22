/**
 * TMNL Variables — Variable Definition
 *
 * defineVariable() is the primary API for declaring variables.
 * Analogous to Emacs defvar/defcustom.
 */

import { Schema, Effect } from 'effect'
import type {
  VariableId,
  VariableScope,
  VariableGroup,
  VariableDefinition,
  VariableMetadata,
  VariableSetterError,
} from './types'
import { VariableId as VariableIdSchema } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Variable Registry (Module-level)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global variable registry.
 * Variables are registered at module load time via defineVariable().
 */
const variableRegistry = new Map<string, VariableDefinition<unknown>>()

/**
 * Get all registered variables.
 */
export function getRegisteredVariables(): ReadonlyMap<string, VariableDefinition<unknown>> {
  return variableRegistry
}

/**
 * Get a specific variable definition.
 */
export function getVariableDefinition(id: string): VariableDefinition<unknown> | undefined {
  return variableRegistry.get(id)
}

/**
 * Clear registry (for testing).
 */
export function clearVariableRegistry(): void {
  variableRegistry.clear()
}

// ─────────────────────────────────────────────────────────────────────────────
// Define Variable Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for defineVariable().
 */
export interface DefineVariableOptions<A> {
  /** Unique variable identifier (e.g., "editor.tabWidth") */
  readonly id: string

  /** Effect Schema for value validation */
  readonly schema: Schema.Schema<A, unknown>

  /** Default value (must pass schema validation) */
  readonly default: A

  /** Human-readable description */
  readonly description: string

  /** Category for organization */
  readonly group: VariableGroup

  /**
   * Scope determines where values can be overridden.
   * @default 'global'
   */
  readonly scope?: VariableScope

  /**
   * Custom setter function.
   * Called after validation, before storage.
   */
  readonly setter?: (value: A) => Effect.Effect<void, VariableSetterError>

  /**
   * Safe for file-local binding.
   * @default false
   */
  readonly safe?: boolean

  /**
   * Show in settings UI (like defcustom vs defvar).
   * @default true
   */
  readonly customize?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Define Variable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Define a variable with schema validation.
 *
 * This is the primary API for declaring variables. Analogous to Emacs defcustom.
 *
 * @example
 * ```typescript
 * const tabWidth = defineVariable({
 *   id: 'editor.tabWidth',
 *   schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
 *   default: 4,
 *   description: 'Number of spaces per tab',
 *   group: 'editor',
 *   scope: 'editor',
 * })
 *
 * // With custom setter
 * const theme = defineVariable({
 *   id: 'ui.theme',
 *   schema: Schema.Literal('light', 'dark', 'system'),
 *   default: 'system',
 *   description: 'Color theme',
 *   group: 'appearance',
 *   setter: (value) => Effect.gen(function* () {
 *     yield* ThemeService.apply(value)
 *   }),
 * })
 * ```
 */
export function defineVariable<A>(options: DefineVariableOptions<A>): VariableDefinition<A> {
  // Validate ID format
  const idResult = Schema.decodeUnknownEither(VariableIdSchema)(options.id)
  if (idResult._tag === 'Left') {
    throw new Error(
      `Invalid variable ID "${options.id}": must be lowercase with dots (e.g., "editor.tabWidth")`
    )
  }

  // Validate default value against schema
  const defaultResult = Schema.decodeUnknownEither(options.schema)(options.default)
  if (defaultResult._tag === 'Left') {
    throw new Error(
      `Invalid default value for variable "${options.id}": ${defaultResult.left.message}`
    )
  }

  // Check for duplicate registration
  if (variableRegistry.has(options.id)) {
    throw new Error(`Variable "${options.id}" is already defined`)
  }

  const definition: VariableDefinition<A> = {
    id: options.id as VariableId,
    schema: options.schema,
    default: options.default,
    description: options.description,
    group: options.group,
    scope: options.scope ?? 'global',
    setter: options.setter,
    safe: options.safe ?? false,
    customize: options.customize ?? true,
  }

  // Register the variable
  variableRegistry.set(options.id, definition as VariableDefinition<unknown>)

  return definition
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract human-readable type description from a Schema.
 * Used for settings UI hints.
 */
function getSchemaTypeDescription(schema: Schema.Schema<unknown, unknown>): string {
  // Get the AST and extract type info
  const ast = schema.ast

  switch (ast._tag) {
    case 'StringKeyword':
      return 'string'
    case 'NumberKeyword':
      return 'number'
    case 'BooleanKeyword':
      return 'boolean'
    case 'Literal':
      return `"${ast.literal}"`
    case 'Union':
      return ast.types.map((t) => getSchemaTypeDescription(Schema.make(t))).join(' | ')
    case 'Refinement':
      return getSchemaTypeDescription(Schema.make(ast.from))
    case 'Transformation':
      return getSchemaTypeDescription(Schema.make(ast.from))
    default:
      return 'unknown'
  }
}

/**
 * Get metadata for a variable definition.
 */
export function getVariableMetadata(definition: VariableDefinition<unknown>): VariableMetadata {
  return {
    id: definition.id,
    description: definition.description,
    group: definition.group as string,
    scope: definition.scope,
    safe: definition.safe,
    customize: definition.customize,
    typeDescription: getSchemaTypeDescription(definition.schema as Schema.Schema<unknown, unknown>),
    hasSetter: definition.setter !== undefined,
  }
}

/**
 * Get metadata for all registered variables.
 */
export function getAllVariableMetadata(): VariableMetadata[] {
  return Array.from(variableRegistry.values()).map(getVariableMetadata)
}

/**
 * Get metadata for variables in a specific group.
 */
export function getVariableMetadataByGroup(group: string): VariableMetadata[] {
  return Array.from(variableRegistry.values())
    .filter((def) => def.group === group)
    .map(getVariableMetadata)
}

/**
 * Get all unique variable groups.
 */
export function getVariableGroups(): string[] {
  const groups = new Set<string>()
  for (const def of variableRegistry.values()) {
    groups.add(def.group as string)
  }
  return Array.from(groups).sort()
}
