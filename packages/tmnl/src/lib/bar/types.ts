/**
 * TMNL Bar — Schema-backed types
 *
 * All bar domain types use Effect Schema for runtime validation,
 * discriminated unions, and encode/decode transforms.
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────

export class Workspace extends Schema.Class<Workspace>('Workspace')({
  idx: Schema.Number,
  name: Schema.NullOr(Schema.String),
  output: Schema.NullOr(Schema.String),
  is_active: Schema.Boolean,
  is_focused: Schema.Boolean,
  active_window_id: Schema.NullOr(Schema.Number),
}) {
  get label(): string {
    return this.name ?? `${this.idx}`
  }

  get hasWindows(): boolean {
    return this.active_window_id !== null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────────────────────────────────────

export class NiriWindow extends Schema.Class<NiriWindow>('NiriWindow')({
  id: Schema.Number,
  title: Schema.NullOr(Schema.String),
  app_id: Schema.NullOr(Schema.String),
  workspace_id: Schema.NullOr(Schema.Number),
  is_focused: Schema.Boolean,
}) {
  get displayTitle(): string {
    return this.title ?? this.app_id ?? 'Unknown'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar Connection Status
// ─────────────────────────────────────────────────────────────────────────────

export const ConnectionStatus = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'error',
)
export type ConnectionStatus = typeof ConnectionStatus.Type

// ─────────────────────────────────────────────────────────────────────────────
// Bar Edge / Layer (mirrors Rust tmnl-shared::state)
// ─────────────────────────────────────────────────────────────────────────────

export const BarEdge = Schema.Literal('left', 'right', 'top', 'bottom')
export type BarEdge = typeof BarEdge.Type

export const BarLayer = Schema.Literal('background', 'bottom', 'top', 'overlay')
export type BarLayer = typeof BarLayer.Type

// ─────────────────────────────────────────────────────────────────────────────
// Niri Event (discriminated union from compositor)
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspacesChanged = Schema.TaggedStruct('WorkspacesChanged', {
  workspaces: Schema.Array(Workspace),
})

export const WorkspaceActivated = Schema.TaggedStruct('WorkspaceActivated', {
  id: Schema.Number,
  focused: Schema.Boolean,
})

export const WindowOpened = Schema.TaggedStruct('WindowOpened', {
  window: NiriWindow,
})

export const WindowClosed = Schema.TaggedStruct('WindowClosed', {
  id: Schema.Number,
})

export const WindowFocusChanged = Schema.TaggedStruct('WindowFocusChanged', {
  id: Schema.NullOr(Schema.Number),
})

export const NiriEvent = Schema.Union(
  WorkspacesChanged,
  WorkspaceActivated,
  WindowOpened,
  WindowClosed,
  WindowFocusChanged,
)
export type NiriEvent = typeof NiriEvent.Type
