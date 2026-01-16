/**
 * Component Domain Schema
 *
 * Defines the structure for CTL-managed components.
 *
 * @module @gbg/ctl/core/domain/component
 */

import { Schema } from "effect"

// =============================================================================
// BRANDED TYPES
// =============================================================================

export const ComponentId = Schema.String.pipe(Schema.brand("ComponentId"))
export type ComponentId = Schema.Schema.Type<typeof ComponentId>

// =============================================================================
// COMPONENT TEMPLATE TYPES
// =============================================================================

export const ComponentTemplate = Schema.Literal(
  "form",
  "list",
  "detail",
  "dashboard",
  "custom"
)
export type ComponentTemplate = Schema.Schema.Type<typeof ComponentTemplate>

// =============================================================================
// COMPONENT PROP DEFINITION
// =============================================================================

export const PropType = Schema.Literal(
  "string",
  "number",
  "boolean",
  "enum",
  "array",
  "object"
)

export class ComponentProp extends Schema.Class<ComponentProp>("ComponentProp")({
  name: Schema.NonEmptyString,
  type: PropType,
  required: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  description: Schema.optional(Schema.String),
  enumValues: Schema.optional(Schema.Array(Schema.String)),
  defaultValue: Schema.optional(Schema.Unknown),
}) {}

// =============================================================================
// COMPONENT ACTION DEFINITION
// =============================================================================

export class ComponentAction extends Schema.Class<ComponentAction>("ComponentAction")({
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  async: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

// =============================================================================
// COMPONENT SLOT DEFINITION
// =============================================================================

export class ComponentSlot extends Schema.Class<ComponentSlot>("ComponentSlot")({
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  required: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

// =============================================================================
// MAIN COMPONENT SCHEMA
// =============================================================================

export class Component extends Schema.Class<Component>("Component")({
  id: ComponentId,
  name: Schema.NonEmptyString,
  template: ComponentTemplate,
  description: Schema.optional(Schema.String),
  props: Schema.optionalWith(Schema.Array(ComponentProp), { default: () => [] }),
  actions: Schema.optionalWith(Schema.Array(ComponentAction), { default: () => [] }),
  slots: Schema.optionalWith(Schema.Array(ComponentSlot), { default: () => [] }),
  route: Schema.optional(Schema.String),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

// =============================================================================
// COMPONENT CREATE INPUT
// =============================================================================

export class ComponentCreateInput extends Schema.Class<ComponentCreateInput>(
  "ComponentCreateInput"
)({
  name: Schema.NonEmptyString,
  template: Schema.optionalWith(ComponentTemplate, { default: () => "custom" as const }),
  description: Schema.optional(Schema.String),
  props: Schema.optionalWith(Schema.Array(ComponentProp), { default: () => [] }),
  actions: Schema.optionalWith(Schema.Array(ComponentAction), { default: () => [] }),
  slots: Schema.optionalWith(Schema.Array(ComponentSlot), { default: () => [] }),
  route: Schema.optional(Schema.String),
}) {}
