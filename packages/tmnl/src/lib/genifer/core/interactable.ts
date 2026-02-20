/**
 * InteractableElement — Bidirectional Component State Protocol
 *
 * Extends UIElement with mutable state that flows both ways:
 *   LLM → component (initial state via props)
 *   component → LLM (state changes via StateSyncService)
 *
 * The state schema declares which fields are mutable and their types,
 * enabling runtime validation of state mutations.
 *
 * @module genifer/core/interactable
 */

import { Schema } from 'effect'

// =============================================================================
// State Field Schema (declares what's mutable)
// =============================================================================

/**
 * A single state field declaration.
 *
 * The LLM defines these when generating a component — they declare
 * which fields the user can mutate and what types are valid.
 */
export class StateFieldDecl extends Schema.Class<StateFieldDecl>('StateFieldDecl')({
  /** Field name (matches a key in the component's state) */
  name: Schema.String,
  /** JSON Schema type: "string" | "number" | "boolean" | "array" | "object" */
  type: Schema.Literal('string', 'number', 'boolean', 'array', 'object'),
  /** Default value (serializable) */
  defaultValue: Schema.Unknown,
  /** Optional human-readable label */
  label: Schema.optional(Schema.String),
  /** Optional validation constraints */
  constraints: Schema.optional(
    Schema.Struct({
      min: Schema.optional(Schema.Number),
      max: Schema.optional(Schema.Number),
      minLength: Schema.optional(Schema.Number),
      maxLength: Schema.optional(Schema.Number),
      pattern: Schema.optional(Schema.String),
      enum: Schema.optional(Schema.Array(Schema.Unknown)),
    }),
  ),
}) {}

/**
 * State schema: array of field declarations.
 * Defines the shape of mutable state for a component instance.
 */
export const StateSchema = Schema.Array(StateFieldDecl)
export type StateSchema = typeof StateSchema.Type

// =============================================================================
// State Change Events
// =============================================================================

/**
 * A single field mutation.
 */
export class StateChange extends Schema.TaggedClass<StateChange>()('StateChange', {
  /** Element key this change belongs to */
  elementKey: Schema.String,
  /** Field name being changed */
  field: Schema.String,
  /** Previous value */
  previousValue: Schema.Unknown,
  /** New value */
  nextValue: Schema.Unknown,
  /** Timestamp (ms since epoch) */
  timestamp: Schema.Number,
  /** Source of the change */
  source: Schema.Literal('user', 'llm', 'system'),
}) {}

/**
 * Batch of state changes (for atomic multi-field updates).
 */
export class StateChangeBatch extends Schema.TaggedClass<StateChangeBatch>()('StateChangeBatch', {
  elementKey: Schema.String,
  changes: Schema.Array(StateChange),
  timestamp: Schema.Number,
}) {}

// =============================================================================
// InteractableElement
// =============================================================================

/**
 * Marker interface for elements with bidirectional state.
 *
 * An InteractableElement extends the base UIElement protocol with:
 * - `stateSchema`: declares mutable fields (set by LLM at generation time)
 * - `initialState`: default values for all state fields
 *
 * The actual mutable state lives in atoms (not in the element itself),
 * managed by the StateSyncService and accessed via useComponentState.
 *
 * Usage in LLM-generated JSON:
 * ```json
 * {
 *   "type": "Slider",
 *   "key": "gain-slider",
 *   "props": { "label": "Gain", "unit": "dB" },
 *   "stateSchema": [
 *     { "name": "value", "type": "number", "defaultValue": 0,
 *       "constraints": { "min": -48, "max": 12 } }
 *   ],
 *   "initialState": { "value": 0 }
 * }
 * ```
 */
export class InteractableElement extends Schema.Class<InteractableElement>('InteractableElement')({
  /** Element key (unique identifier) */
  key: Schema.String,
  /** Component type name */
  type: Schema.String,
  /** Static props (immutable, set by LLM) */
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Children element keys */
  children: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Parent element key */
  parentKey: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  /** Mutable state field declarations */
  stateSchema: Schema.optionalWith(StateSchema, { default: () => [] }),
  /** Initial state values (keyed by field name) */
  initialState: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) },
  ),
}) {
  /** Check if this element has any mutable state */
  get isInteractable(): boolean {
    return this.stateSchema.length > 0
  }

  /** Get default state from schema declarations */
  get defaultState(): Record<string, unknown> {
    const state: Record<string, unknown> = {}
    for (const field of this.stateSchema) {
      state[field.name] = this.initialState[field.name] ?? field.defaultValue
    }
    return state
  }

  /** Validate a state mutation against the schema constraints */
  validateField(fieldName: string, value: unknown): string | null {
    const decl = this.stateSchema.find((f) => f.name === fieldName)
    if (!decl) return `Unknown state field: ${fieldName}`

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value
    if (actualType !== decl.type && value !== null) {
      return `Expected ${decl.type} for ${fieldName}, got ${actualType}`
    }

    // Constraint checks
    const c = decl.constraints
    if (c && typeof value === 'number') {
      if (c.min !== undefined && value < c.min) return `${fieldName} must be >= ${c.min}`
      if (c.max !== undefined && value > c.max) return `${fieldName} must be <= ${c.max}`
    }
    if (c && typeof value === 'string') {
      if (c.minLength !== undefined && value.length < c.minLength)
        return `${fieldName} must be >= ${c.minLength} chars`
      if (c.maxLength !== undefined && value.length > c.maxLength)
        return `${fieldName} must be <= ${c.maxLength} chars`
      if (c.pattern && !new RegExp(c.pattern).test(value))
        return `${fieldName} doesn't match pattern ${c.pattern}`
    }
    if (c?.enum && !c.enum.includes(value)) {
      return `${fieldName} must be one of: ${c.enum.join(', ')}`
    }

    return null // valid
  }
}

// =============================================================================
// Type guards
// =============================================================================

/** Check if a raw element object has interactable properties */
export function hasStateSchema(element: { stateSchema?: unknown }): boolean {
  return Array.isArray(element.stateSchema) && element.stateSchema.length > 0
}
