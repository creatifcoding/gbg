/**
 * Actor Schemas - Effect Schema Definitions
 *
 * Pure Effect Schema definitions for workspace and session state.
 * These wrap RivetKit's Zod-based validation with Effect Schema.
 *
 * @module lib/actors/schemas
 */

import { Schema } from 'effect'

// Re-export RivetKit config schemas (for wrapping RivetKit APIs)
export * from './rivet-config'

// Re-export action parameter schemas (for validating hook calls)
export * from './actions'

// =============================================================================
// Branded IDs
// =============================================================================

export const BufferId = Schema.String.pipe(Schema.brand('BufferId'))
export type BufferId = typeof BufferId.Type

export const TabId = Schema.String.pipe(Schema.brand('TabId'))
export type TabId = typeof TabId.Type

export const WindowId = Schema.String.pipe(Schema.brand('WindowId'))
export type WindowId = typeof WindowId.Type

export const UserId = Schema.String.pipe(Schema.brand('UserId'))
export type UserId = typeof UserId.Type

// =============================================================================
// Buffer Types
// =============================================================================

export const BufferType = Schema.Literal('document', 'terminal', 'webview', 'widget', 'canvas')
export type BufferType = typeof BufferType.Type

export const BufferMeta = Schema.Struct({
  id: BufferId,
  type: BufferType,
  name: Schema.String,
  uri: Schema.String,
  ysweetDocId: Schema.optional(Schema.String),
  documentId: Schema.optional(Schema.String),
  filePath: Schema.optional(Schema.String),
  mimeType: Schema.optional(Schema.String),
  createdAt: Schema.String,
  modifiedAt: Schema.String,
})
export type BufferMeta = typeof BufferMeta.Type

export const BufferEntry = Schema.Struct({
  meta: BufferMeta,
  refCount: Schema.Number,
  openedBy: Schema.Array(UserId),
})
export type BufferEntry = typeof BufferEntry.Type

export const WorkspaceState = Schema.Struct({
  buffers: Schema.Record({ key: BufferId, value: BufferEntry }),
})
export type WorkspaceState = typeof WorkspaceState.Type

// =============================================================================
// Session Types
// =============================================================================

export const CursorPosition = Schema.Struct({
  offset: Schema.Number,
  line: Schema.optional(Schema.Number),
  column: Schema.optional(Schema.Number),
})
export type CursorPosition = typeof CursorPosition.Type

export const ScrollPosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type ScrollPosition = typeof ScrollPosition.Type

export const EditorMode = Schema.Struct({
  major: Schema.String,
  minor: Schema.Array(Schema.String),
})
export type EditorMode = typeof EditorMode.Type

export const SessionTab = Schema.Struct({
  id: TabId,
  name: Schema.String,
  layout: Schema.Unknown, // PaneNode tree - opaque for now
  activeWindowId: Schema.NullOr(WindowId),
  isPinned: Schema.Boolean,
  order: Schema.Number,
})
export type SessionTab = typeof SessionTab.Type

export const SessionWindow = Schema.Struct({
  id: WindowId,
  bufferId: BufferId,
  scroll: ScrollPosition,
  mode: EditorMode,
  isFocused: Schema.Boolean,
  cursor: Schema.optional(CursorPosition),
})
export type SessionWindow = typeof SessionWindow.Type

export const SessionState = Schema.Struct({
  tabs: Schema.Record({ key: TabId, value: SessionTab }),
  windows: Schema.Record({ key: WindowId, value: SessionWindow }),
  activeTabId: Schema.NullOr(TabId),
  focusedWindowId: Schema.NullOr(WindowId),
  tabOrder: Schema.Array(TabId),
})
export type SessionState = typeof SessionState.Type

// =============================================================================
// Events (for pub/sub)
// =============================================================================

export const BufferCreatedEvent = Schema.TaggedStruct('BufferCreated', {
  bufferId: BufferId,
  meta: BufferMeta,
  userId: UserId,
})
export type BufferCreatedEvent = typeof BufferCreatedEvent.Type

export const BufferOpenedEvent = Schema.TaggedStruct('BufferOpened', {
  bufferId: BufferId,
  userId: UserId,
})
export type BufferOpenedEvent = typeof BufferOpenedEvent.Type

export const BufferClosedEvent = Schema.TaggedStruct('BufferClosed', {
  bufferId: BufferId,
})
export type BufferClosedEvent = typeof BufferClosedEvent.Type

export const WorkspaceEvent = Schema.Union(
  BufferCreatedEvent,
  BufferOpenedEvent,
  BufferClosedEvent
)
export type WorkspaceEvent = typeof WorkspaceEvent.Type

export const TabCreatedEvent = Schema.TaggedStruct('TabCreated', {
  tabId: TabId,
  tab: SessionTab,
})
export type TabCreatedEvent = typeof TabCreatedEvent.Type

export const TabClosedEvent = Schema.TaggedStruct('TabClosed', {
  tabId: TabId,
})
export type TabClosedEvent = typeof TabClosedEvent.Type

export const WindowFocusedEvent = Schema.TaggedStruct('WindowFocused', {
  windowId: WindowId,
})
export type WindowFocusedEvent = typeof WindowFocusedEvent.Type

export const SessionEvent = Schema.Union(
  TabCreatedEvent,
  TabClosedEvent,
  WindowFocusedEvent
)
export type SessionEvent = typeof SessionEvent.Type

// =============================================================================
// Persistence Envelope
// =============================================================================

export const PersistedState = Schema.Struct({
  version: Schema.Number,
  workspace: WorkspaceState,
  sessions: Schema.Record({ key: UserId, value: SessionState }),
  updatedAt: Schema.String,
})
export type PersistedState = typeof PersistedState.Type
