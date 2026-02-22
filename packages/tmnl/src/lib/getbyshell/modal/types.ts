/**
 * Modal System — Schema types.
 *
 * Modals fill the overlay zone right of the bar strip.
 * Like Popover, they are hidden surfaces within the same
 * layer-shell window — no separate Tauri webview.
 *
 * The key difference: a Modal takes over the entire overlay,
 * while a Popover is a small floating panel.
 */

import { Schema } from 'effect'

/** Modal entrance animation style */
export const ModalEntrance = Schema.Literal(
  'fade',
  'slide-right',
  'bloom',
  'holographic',
)
export type ModalEntrance = typeof ModalEntrance.Type

/** Logical rect describing the modal's occupied area. */
export class ModalRect extends Schema.Class<ModalRect>('ModalRect')({
  x: Schema.Number,
  y: Schema.Number,
  w: Schema.Number,
  h: Schema.Number,
}) {}

/** A registered modal instance. */
export class ModalEntry extends Schema.Class<ModalEntry>('ModalEntry')({
  id: Schema.String,
  rect: ModalRect,
}) {}
