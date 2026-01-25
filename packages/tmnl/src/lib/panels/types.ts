/**
 * Panel System Types
 *
 * Schema-based panel definitions following TMNL conventions
 */

import { Schema } from 'effect';

// ─────────────────────────────────────────────────────────────────────────────
// Branded IDs
// ─────────────────────────────────────────────────────────────────────────────

export const PanelId = Schema.String.pipe(Schema.brand('PanelId'));
export type PanelId = typeof PanelId.Type;

export const LayoutId = Schema.String.pipe(Schema.brand('LayoutId'));
export type LayoutId = typeof LayoutId.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Panel Direction
// ─────────────────────────────────────────────────────────────────────────────

export const PanelDirection = Schema.Literal('horizontal', 'vertical');
export type PanelDirection = typeof PanelDirection.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Panel Type
// ─────────────────────────────────────────────────────────────────────────────

export const PanelType = Schema.Literal(
  'empty',
  'grid',
  'chart',
  'terminal',
  'editor',
  'canvas',
  'custom'
);
export type PanelType = typeof PanelType.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Panel Config
// ─────────────────────────────────────────────────────────────────────────────

export const PanelConfig = Schema.Struct({
  _tag: Schema.Literal('PanelConfig'),
  id: PanelId,
  type: PanelType,
  title: Schema.NullOr(Schema.String),
  defaultSize: Schema.NullOr(Schema.Number),
  minSize: Schema.NullOr(Schema.Number),
  maxSize: Schema.NullOr(Schema.Number),
  collapsible: Schema.Boolean,
  collapsed: Schema.Boolean,
  metadata: Schema.NullOr(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});

export type PanelConfig = typeof PanelConfig.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Panel Group Config
// ─────────────────────────────────────────────────────────────────────────────

export const PanelGroupConfig = Schema.Struct({
  _tag: Schema.Literal('PanelGroupConfig'),
  id: Schema.String,
  direction: PanelDirection,
  panels: Schema.Array(PanelId),
  autoSaveId: Schema.NullOr(Schema.String),
});

export type PanelGroupConfig = typeof PanelGroupConfig.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Layout Config
// ─────────────────────────────────────────────────────────────────────────────

export const LayoutConfig = Schema.Struct({
  _tag: Schema.Literal('LayoutConfig'),
  id: LayoutId,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  rootGroup: Schema.String,
  groups: Schema.Array(PanelGroupConfig),
  panels: Schema.Array(PanelConfig),
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
});

export type LayoutConfig = typeof LayoutConfig.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Panel State
// ─────────────────────────────────────────────────────────────────────────────

export const PanelState = Schema.Struct({
  _tag: Schema.Literal('PanelState'),
  id: PanelId,
  size: Schema.Number,
  collapsed: Schema.Boolean,
  visible: Schema.Boolean,
});

export type PanelState = typeof PanelState.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Layout State
// ─────────────────────────────────────────────────────────────────────────────

export const LayoutState = Schema.Struct({
  _tag: Schema.Literal('LayoutState'),
  layoutId: LayoutId,
  panelStates: Schema.Record({ key: Schema.String, value: PanelState }),
  activePanel: Schema.NullOr(PanelId),
});

export type LayoutState = typeof LayoutState.Type;
