/**
 * Geometry primitives — Position, Dimensions, DimensionConstraints.
 *
 * @module floating/types/geometry
 */

import { Schema } from 'effect'

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Position = typeof Position.Type

export const Dimensions = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
})
export type Dimensions = typeof Dimensions.Type

export const DimensionConstraints = Schema.Struct({
  minWidth: Schema.optionalWith(Schema.Number, { default: () => 200 }),
  minHeight: Schema.optionalWith(Schema.Number, { default: () => 150 }),
  maxWidth: Schema.optional(Schema.Number),
  maxHeight: Schema.optional(Schema.Number),
})
export type DimensionConstraints = typeof DimensionConstraints.Type
