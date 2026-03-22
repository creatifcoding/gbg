/**
 * Genifer Surface + DataSource + Action Binding Schemas
 *
 * A Surface is a live, hydrated, interactive genifer render tree
 * that exists inline in the chat thread. Multiple surfaces coexist.
 *
 * DataSourceBinding: how an element connects to live state
 *   - static:  inline value from LLM (mock data)
 *   - atom:    live atom binding (real-time reactive)
 *   - query:   Effect query (async, cached)
 *   - rpc:     RPC call (on-demand)
 *
 * ActionBinding: what happens when the user interacts
 *   - setState:   mutate local state
 *   - emitEvent:  emit on event bus
 *   - callRpc:    invoke a service RPC
 *   - navigate:   route navigation
 *
 * @module genifer/harness/surface
 */

import { Schema } from 'effect'
import {
  SurfaceId,
  TreeId,
  ThreadId,
  ToolCallId,
  SessionId,
} from '../identifiers'

// =============================================================================
// DataSource Binding
// =============================================================================

/** Type of data source an element can bind to */
export const DataSourceType = Schema.Literal(
  'static',   // Inline value from LLM (mock data, initial generation)
  'atom',     // Live atom binding — real-time reactive updates
  'query',    // Effect query — async with optional caching
  'rpc',      // RPC call — on-demand fetch
)
export type DataSourceType = typeof DataSourceType.Type

/**
 * Describes how a single element field binds to a data source.
 *
 * Progressive binding:
 *   1. LLM generates with static: { type: "static", key: "users", staticValue: 1234 }
 *   2. User promotes to live:     { type: "atom", key: "iiot/userCountAtom" }
 *   3. Persistence stores binding, rehydration resolves it
 */
export class DataSourceBinding extends Schema.TaggedClass<DataSourceBinding>()(
  'DataSourceBinding',
  {
    /** Which type of data source */
    type: DataSourceType,
    /** Identifier: atom key/path, query name, rpc tag, or logical name */
    key: Schema.String,
    /** For static: the inline value */
    staticValue: Schema.optional(Schema.Unknown),
    /** Which element prop this binding feeds (e.g., 'value', 'title', 'items') */
    targetProp: Schema.String,
    /** Optional transform expression applied after fetch */
    transform: Schema.optional(Schema.String),
    /** Refresh interval for query/rpc sources (ms, 0 = once, undefined = real-time) */
    refreshMs: Schema.optional(Schema.Number),
  },
) {
  /** Is this a live (non-static) binding? */
  get isLive(): boolean {
    return this.type !== 'static'
  }
}

// =============================================================================
// Action Binding
// =============================================================================

/** Type of action triggered by user interaction */
export const ActionType = Schema.Literal(
  'setState',    // Mutate local element state (via StateSyncService)
  'emitEvent',   // Emit on event bus
  'callRpc',     // Invoke a service RPC
  'navigate',    // Route navigation
)
export type ActionType = typeof ActionType.Type

/**
 * Describes what happens when the user interacts with an element.
 *
 * Example:
 * ```json
 * {
 *   "type": "callRpc",
 *   "trigger": "onClick",
 *   "target": "genifer/GeniferService.upsertComposite",
 *   "payload": { "name": "{{state.name}}" }
 * }
 * ```
 */
export class ActionBinding extends Schema.TaggedClass<ActionBinding>()(
  'ActionBinding',
  {
    /** Action type */
    type: ActionType,
    /** DOM event trigger (onClick, onChange, onSubmit, etc.) */
    trigger: Schema.String,
    /** Target: atom key, event name, rpc tag, or URL */
    target: Schema.String,
    /** Payload template (supports {{state.field}} interpolation) */
    payload: Schema.optional(Schema.Unknown),
    /** Confirmation prompt (if set, user must confirm before action executes) */
    confirmPrompt: Schema.optional(Schema.String),
  },
) {}

// =============================================================================
// Surface Quality Metadata
// =============================================================================

export class SurfaceQuality extends Schema.TaggedClass<SurfaceQuality>()(
  'SurfaceQuality',
  {
    score: Schema.Number,
    elementCount: Schema.Number,
    repairCount: Schema.Number,
    model: Schema.String,
    durationMs: Schema.Number,
  },
) {
  get isPerfect(): boolean {
    return this.score >= 1.0 && this.repairCount === 0
  }
}

// =============================================================================
// GeniferSurface — A Live Render Tree in the Chat Thread
// =============================================================================

/**
 * A Surface is a single genifer render tree living inline in the chat.
 * Multiple surfaces can coexist in one conversation thread.
 *
 * Each surface has:
 *   - A UITree (the component tree)
 *   - DataSource bindings (how elements connect to live state)
 *   - Action bindings (how user interactions flow back to services)
 *   - Quality metadata (pipeline score, element count, repair count)
 *   - Version tracking (refinement creates new versions)
 *   - Thread membership (surfaces in the same conversation thread)
 *
 * Lifecycle:
 *   genifer_generate → Surface v1 (static data)
 *   user promotes bindings → Surface v1 (live data)
 *   genifer_refine → Surface v2 (linked to v1)
 */
/** Surface status — Schema.Literal for runtime validation */
export const SurfaceStatus = Schema.Literal('streaming', 'complete', 'error', 'collapsed')
export type SurfaceStatus = typeof SurfaceStatus.Type

export class GeniferSurface extends Schema.TaggedClass<GeniferSurface>()(
  'GeniferSurface',
  {
    /** Unique surface ID (stable across versions) */
    id: SurfaceId,
    /** Database tree ID (null until persisted) */
    treeId: Schema.NullOr(TreeId),
    /** Thread this surface belongs to */
    threadId: ThreadId,
    /** Tool call ID that created this surface */
    toolCallId: ToolCallId,
    /** Session ID */
    sessionId: SessionId,
    /** The serialized UITree JSON (live tree lives in atoms, this is snapshot) */
    treeSnapshot: Schema.Unknown,
    /** Latest incremental patch for streaming UI hydration */
    treePatch: Schema.optional(Schema.Unknown),
    /** Monotonic sequence number for treePatch de-duplication */
    patchSeq: Schema.optional(Schema.Number),
    /** Surface version (increments on refine) */
    version: Schema.Number,
    /** Parent surface ID (if refined from another) */
    parentSurfaceId: Schema.NullOr(SurfaceId),
    /** Active data source bindings (keyed by elementKey:propName) */
    dataBindings: Schema.Record({
      key: Schema.String,
      value: DataSourceBinding,
    }),
    /** Active action bindings (keyed by elementKey:trigger) */
    actionBindings: Schema.Record({
      key: Schema.String,
      value: ActionBinding,
    }),
    /** Quality metadata */
    quality: SurfaceQuality,
    /** The prompt that generated this surface */
    prompt: Schema.String,
    /** Refinement instruction (if this is a refinement) */
    instruction: Schema.NullOr(Schema.String),
    /** Current display status */
    status: SurfaceStatus,
    /** Creation timestamp */
    createdAt: Schema.Number,
  },
) {
  /** Is this surface a refinement of another? */
  get isRefinement(): boolean {
    return this.parentSurfaceId !== null
  }

  /** Has this surface been persisted to PostgreSQL? */
  get isPersisted(): boolean {
    return this.treeId !== null
  }

  /** Is the surface currently streaming (generation in progress)? */
  get isStreaming(): boolean {
    return this.status === 'streaming'
  }

  /** Binding key for a specific element prop */
  static bindingKey(elementKey: string, propName: string): string {
    return `${elementKey}:${propName}`
  }

  /** Action key for a specific element trigger */
  static actionKey(elementKey: string, trigger: string): string {
    return `${elementKey}:${trigger}`
  }
}
