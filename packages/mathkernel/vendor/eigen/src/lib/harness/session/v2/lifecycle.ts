/**
 * Session Lifecycle Schemas
 *
 * States, transitions, and events for the lifecycle Machine.
 * Feeds into @effect/experimental Machine.makeSerializable in Phase 2.
 *
 * @module harness/session/v2/lifecycle
 */

import { Schema } from 'effect'
import { HarnessSessionId } from './identity'

// =============================================================================
// Lifecycle States
// =============================================================================

/**
 * Session lifecycle states.
 *
 * Replaces the implicit atom mutations in current useHarnessAdapter.
 * Each state has well-defined allowed transitions — no invalid jumps.
 */
export const SessionLifecycleState = Schema.Literal(
  /** No active session — idle panel */
  'idle',
  /** Establishing connection to server */
  'connecting',
  /** Connected, session open, not streaming */
  'connected',
  /** Actively streaming LLM response */
  'streaming',
  /** Running compaction (summarizing old context) */
  'compacting',
  /** Processing a branch operation */
  'branching',
  /** Tearing down session resources */
  'disposing',
  /** Session fully disposed — terminal state */
  'disposed',
)
export type SessionLifecycleState = typeof SessionLifecycleState.Type

/** All states for iteration */
export const LIFECYCLE_STATES = [
  'idle', 'connecting', 'connected', 'streaming',
  'compacting', 'branching', 'disposing', 'disposed',
] as const

/** Terminal states — no transitions out */
export const TERMINAL_STATES = new Set<SessionLifecycleState>(['disposed'])

/** States where content mutation is allowed */
export const MUTABLE_STATES = new Set<SessionLifecycleState>([
  'connected', 'streaming', 'compacting', 'branching',
])

// =============================================================================
// Lifecycle Transition Events
// =============================================================================

/** Request to create a new session */
export const ConnectEvent = Schema.TaggedStruct('Connect', {
  sessionId: HarnessSessionId,
})
export type ConnectEvent = typeof ConnectEvent.Type

/** Connection established */
export const ConnectedEvent = Schema.TaggedStruct('Connected', {})
export type ConnectedEvent = typeof ConnectedEvent.Type

/** Connection failed */
export const ConnectFailedEvent = Schema.TaggedStruct('ConnectFailed', {
  reason: Schema.String,
})
export type ConnectFailedEvent = typeof ConnectFailedEvent.Type

/** LLM streaming started */
export const StreamStartEvent = Schema.TaggedStruct('StreamStart', {})
export type StreamStartEvent = typeof StreamStartEvent.Type

/** LLM streaming completed */
export const StreamEndEvent = Schema.TaggedStruct('StreamEnd', {})
export type StreamEndEvent = typeof StreamEndEvent.Type

/** LLM streaming errored */
export const StreamErrorEvent = Schema.TaggedStruct('StreamError', {
  reason: Schema.String,
})
export type StreamErrorEvent = typeof StreamErrorEvent.Type

/** Compaction started */
export const CompactStartEvent = Schema.TaggedStruct('CompactStart', {})
export type CompactStartEvent = typeof CompactStartEvent.Type

/** Compaction completed */
export const CompactEndEvent = Schema.TaggedStruct('CompactEnd', {})
export type CompactEndEvent = typeof CompactEndEvent.Type

/** Branch operation started */
export const BranchStartEvent = Schema.TaggedStruct('BranchStart', {})
export type BranchStartEvent = typeof BranchStartEvent.Type

/** Branch operation completed */
export const BranchEndEvent = Schema.TaggedStruct('BranchEnd', {})
export type BranchEndEvent = typeof BranchEndEvent.Type

/** Dispose request */
export const DisposeEvent = Schema.TaggedStruct('Dispose', {})
export type DisposeEvent = typeof DisposeEvent.Type

/** Reset to idle (e.g., after error recovery) */
export const ResetEvent = Schema.TaggedStruct('Reset', {})
export type ResetEvent = typeof ResetEvent.Type

/**
 * All lifecycle transition events.
 */
export const LifecycleEvent = Schema.Union(
  ConnectEvent,
  ConnectedEvent,
  ConnectFailedEvent,
  StreamStartEvent,
  StreamEndEvent,
  StreamErrorEvent,
  CompactStartEvent,
  CompactEndEvent,
  BranchStartEvent,
  BranchEndEvent,
  DisposeEvent,
  ResetEvent,
)
export type LifecycleEvent = typeof LifecycleEvent.Type

// =============================================================================
// Transition Table (for validation — Machine uses this in Phase 2)
// =============================================================================

/**
 * Valid transitions: from → [event → to].
 * Machine.makeSerializable will enforce these at runtime.
 * This table serves as documentation AND validation source.
 */
export const TRANSITION_TABLE: Record<
  SessionLifecycleState,
  Partial<Record<LifecycleEvent['_tag'], SessionLifecycleState>>
> = {
  idle:       { Connect: 'connecting' },
  connecting: { Connected: 'connected', ConnectFailed: 'idle' },
  connected:  { StreamStart: 'streaming', CompactStart: 'compacting', BranchStart: 'branching', Dispose: 'disposing' },
  streaming:  { StreamEnd: 'connected', StreamError: 'connected', Dispose: 'disposing' },
  compacting: { CompactEnd: 'connected', Dispose: 'disposing' },
  branching:  { BranchEnd: 'connected', Dispose: 'disposing' },
  disposing:  { Reset: 'idle' },
  disposed:   {},
}

/**
 * Check if a transition is valid.
 */
export function isValidTransition(
  from: SessionLifecycleState,
  event: LifecycleEvent['_tag'],
): boolean {
  return TRANSITION_TABLE[from]?.[event] !== undefined
}

/**
 * Get the target state for a transition (if valid).
 */
export function getTransitionTarget(
  from: SessionLifecycleState,
  event: LifecycleEvent['_tag'],
): SessionLifecycleState | undefined {
  return TRANSITION_TABLE[from]?.[event]
}
