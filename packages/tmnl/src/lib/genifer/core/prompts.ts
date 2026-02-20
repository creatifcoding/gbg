/**
 * Prompt Templating — Structured prompt construction for genifer
 *
 * Templates define reusable prompt structures with typed slots.
 * Slots are filled at runtime with values + catalog context.
 *
 * Usage:
 *   const tmpl = new PromptTemplate({
 *     name: 'generate-dashboard',
 *     template: 'Generate a {{style}} dashboard with {{count}} widgets using: {{catalog}}',
 *     slots: [
 *       new PromptSlot({ name: 'style', type: 'string', required: true }),
 *       new PromptSlot({ name: 'count', type: 'number', required: true, defaultValue: 4 }),
 *       new PromptSlot({ name: 'catalog', type: 'catalog', required: false }),
 *     ],
 *   })
 *
 * @module genifer/core/prompts
 */

import { Schema } from 'effect'

// =============================================================================
// Slot Types
// =============================================================================

export const PromptSlotType = Schema.Literal('string', 'number', 'boolean', 'catalog', 'json')
export type PromptSlotType = typeof PromptSlotType.Type

// =============================================================================
// Compile Error (tagged, not generic Error)
// =============================================================================

export class PromptCompileError extends Error {
  readonly _tag = 'PromptCompileError' as const
  constructor(
    readonly templateName: string,
    readonly detail: string,
  ) {
    super(`PromptCompileError [${templateName}]: ${detail}`)
    this.name = 'PromptCompileError'
  }
}

// =============================================================================
// Runtime Slot Type Validation
// =============================================================================

function validateSlotType(slotName: string, expectedType: PromptSlotType, value: unknown): string | null {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string' ? null : `Slot '${slotName}' expects string, got ${typeof value}`
    case 'number':
      return typeof value === 'number' ? null : `Slot '${slotName}' expects number, got ${typeof value}`
    case 'boolean':
      return typeof value === 'boolean' ? null : `Slot '${slotName}' expects boolean, got ${typeof value}`
    case 'json':
      return typeof value === 'object' ? null : `Slot '${slotName}' expects json (object), got ${typeof value}`
    case 'catalog':
      return null // catalog values are handled separately
  }
}

// =============================================================================
// PromptSlot — typed placeholder in a template
// =============================================================================

export class PromptSlot extends Schema.Class<PromptSlot>('PromptSlot')({
  /** Slot name — matches {{name}} in template string */
  name: Schema.String,
  /** Expected value type */
  type: PromptSlotType,
  /** Whether the slot must be filled */
  required: Schema.Boolean,
  /** Default value (used when slot is not filled) */
  defaultValue: Schema.optional(Schema.Unknown),
  /** Human description for the slot */
  description: Schema.optional(Schema.String),
}) {}

// =============================================================================
// PromptTemplate — reusable prompt with slots
// =============================================================================

export class PromptTemplate extends Schema.Class<PromptTemplate>('PromptTemplate')({
  /** Unique template name */
  name: Schema.String,
  /** Template string with {{slot}} placeholders */
  template: Schema.String,
  /** Slot declarations */
  slots: Schema.Array(PromptSlot),
  /** Optional description */
  description: Schema.optional(Schema.String),
  /** Tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String)),
}) {
  /** Get slot names extracted from template string */
  get slotNames(): string[] {
    const matches = this.template.match(/\{\{(\w+)\}\}/g)
    return matches ? matches.map((m) => m.slice(2, -2)) : []
  }

  /** Check if all required slots have values or defaults */
  validateSlots(values: Record<string, unknown>): string | null {
    for (const slot of this.slots) {
      if (slot.required && values[slot.name] === undefined && slot.defaultValue === undefined) {
        return `Required slot '${slot.name}' has no value or default`
      }
    }
    return null
  }

  /**
   * Compile the template with slot values. Returns the filled string.
   *
   * Validates slot types at runtime and replaces ALL occurrences of each
   * placeholder (not just the first). After substitution, scans for
   * unresolved placeholders and throws a typed PromptCompileError.
   */
  compile(values: Record<string, unknown>, catalogContext?: string): string {
    const error = this.validateSlots(values)
    if (error) throw new PromptCompileError(this.name, error)

    let result = this.template

    for (const slot of this.slots) {
      const value = values[slot.name] ?? slot.defaultValue
      const placeholder = `{{${slot.name}}}`

      // Runtime type validation
      if (value !== undefined && slot.type !== 'catalog') {
        const typeError = validateSlotType(slot.name, slot.type, value)
        if (typeError) throw new PromptCompileError(this.name, typeError)
      }

      if (slot.type === 'catalog' && catalogContext) {
        result = result.replaceAll(placeholder, catalogContext)
      } else if (value !== undefined) {
        const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
        result = result.replaceAll(placeholder, str)
      } else {
        // Remove unfilled optional placeholders
        result = result.replaceAll(placeholder, '')
      }
    }

    // Scan for unresolved placeholders
    const unresolved = result.match(/\{\{(\w+)\}\}/g)
    if (unresolved && unresolved.length > 0) {
      throw new PromptCompileError(
        this.name,
        `Unresolved placeholders: ${unresolved.join(', ')}`,
      )
    }

    return result.trim()
  }
}

// =============================================================================
// Compiled Prompt — result of template compilation
// =============================================================================

export class CompiledPrompt extends Schema.Class<CompiledPrompt>('CompiledPrompt')({
  /** Source template name */
  templateName: Schema.String,
  /** The fully compiled prompt string */
  text: Schema.String,
  /** Slot values used */
  slotValues: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Timestamp of compilation */
  timestamp: Schema.Number,
}) {}
