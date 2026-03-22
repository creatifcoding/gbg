/**
 * Genifer Branded Identifiers
 *
 * All Genifer entity identifiers use branded types via Effect Schema.
 * This gives us:
 *   - Compile-time type safety (can't pass a ThreadId where SurfaceId is expected)
 *   - Runtime validation via Schema.decode
 *   - Consistent nanoid generation via make() helpers
 *
 * Pattern: @gbg/tmnl/genifer/{Entity}Id
 *
 * @module genifer/identifiers
 */

import { Schema } from 'effect'
import { nanoid } from 'nanoid'

// ─────────────────────────────────────────────────────────────────────────────
// SurfaceId — unique per genifer surface (stable across versions)
// ─────────────────────────────────────────────────────────────────────────────

export const SurfaceId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/genifer/SurfaceId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/genifer/SurfaceId',
    description: 'Unique identifier for a Genifer surface',
  }),
)
export type SurfaceId = typeof SurfaceId.Type

export const makeSurfaceId = (): SurfaceId => nanoid() as SurfaceId

// ─────────────────────────────────────────────────────────────────────────────
// ThreadId — groups surfaces in a conversation thread
// ─────────────────────────────────────────────────────────────────────────────

export const ThreadId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/genifer/ThreadId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/genifer/ThreadId',
    description: 'Conversation thread identifier for Genifer surface grouping',
  }),
)
export type ThreadId = typeof ThreadId.Type

export const makeThreadId = (): ThreadId => nanoid() as ThreadId

// ─────────────────────────────────────────────────────────────────────────────
// SessionId — harness session scope
// ─────────────────────────────────────────────────────────────────────────────

export const SessionId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/genifer/SessionId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/genifer/SessionId',
    description: 'Harness session identifier for Genifer operations',
  }),
)
export type SessionId = typeof SessionId.Type

export const makeSessionId = (): SessionId => `harness-${Date.now()}` as SessionId

// ─────────────────────────────────────────────────────────────────────────────
// TreeId — persisted tree in storage (nullable until saved)
// ─────────────────────────────────────────────────────────────────────────────

export const TreeId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/genifer/TreeId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/genifer/TreeId',
    description: 'Persisted UITree identifier in Genifer storage',
  }),
)
export type TreeId = typeof TreeId.Type

// ─────────────────────────────────────────────────────────────────────────────
// PanelId — floating panel instance
// ─────────────────────────────────────────────────────────────────────────────

export const PanelId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/genifer/PanelId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/genifer/PanelId',
    description: 'Floating panel instance identifier',
  }),
)
export type PanelId = typeof PanelId.Type

let _panelSeq = 0
export const makePanelId = (): PanelId =>
  `p-genifer-${++_panelSeq}-${Date.now().toString(36)}` as PanelId

// ─────────────────────────────────────────────────────────────────────────────
// ToolCallId — correlates with the LLM tool_use block
// ─────────────────────────────────────────────────────────────────────────────

export const ToolCallId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/genifer/ToolCallId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/genifer/ToolCallId',
    description: 'Tool call correlation identifier from LLM tool_use block',
  }),
)
export type ToolCallId = typeof ToolCallId.Type
