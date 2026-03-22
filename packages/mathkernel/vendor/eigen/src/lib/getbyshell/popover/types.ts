/**
 * Popover System — Schema types.
 *
 * Placement is always relative to the bar's left edge.
 * Popovers render in the overlay zone (48px–400px).
 */

import { Schema } from 'effect'

export const PopoverPlacement = Schema.Literal('right-start', 'right-center', 'right-end')
export type PopoverPlacement = typeof PopoverPlacement.Type

/** Logical rect for input region sync with Rust. */
export class PopoverRect extends Schema.Class<PopoverRect>('PopoverRect')({
  x: Schema.Number,
  y: Schema.Number,
  w: Schema.Number,
  h: Schema.Number,
}) {}

/** A registered popover instance. */
export class PopoverEntry extends Schema.Class<PopoverEntry>('PopoverEntry')({
  id: Schema.String,
  rect: PopoverRect,
}) {}
