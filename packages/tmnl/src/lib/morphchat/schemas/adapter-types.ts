/**
 * MorphChat Adapter Interface
 *
 * The adapter is the data bridge between a MorphChat surface and its backend.
 * Surfaces define what they need; adapters provide it. This decouples
 * rendering from data transport entirely.
 *
 * Adapters expose Atoms (not streams, not callbacks). Surfaces subscribe
 * to atoms via effect-atom. This is the Atom-as-State pattern from AGENTS.md.
 *
 * @module morphchat/schemas/adapter-types
 */

import type { Atom } from '@effect-atom/atom'
import type { Effect } from 'effect'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
  SendParams,
} from './message-types'

// =============================================================================
// Transfer Surface Config
// =============================================================================

/**
 * Configuration for transfer system integration.
 *
 * When provided, the surface enables drag-out (inline tasks, messages)
 * and/or drop-in (composer references) via the TMNL transfer system.
 */
export interface TransferSurfaceConfig {
  /** Surface ID for transfer registration */
  readonly surfaceId: string
  /** Label for transfer cluster */
  readonly clusterLabel: string
  /** Enable drag-out from inline tasks */
  readonly enableDrag: boolean
  /** Enable drop-in to composer */
  readonly enableDrop: boolean
}

// =============================================================================
// MorphChat Adapter Interface
// =============================================================================

/**
 * The canonical adapter interface for MorphChat surfaces.
 *
 * Every data operation is either:
 * - An Atom (reactive state — surfaces subscribe directly)
 * - An Effect (async operation — surfaces trigger via atom ops)
 *
 * Consumers implement this interface for their specific backend:
 * WebSocket, REST, mock, conductor, etc.
 */
export interface MorphChatAdapter {
  // ── Identity ─────────────────────────────────────────────

  /** Unique adapter identifier — scopes atom families, prevents cross-talk */
  readonly adapterId: string

  /** Human-readable adapter label (for debug/testbed) */
  readonly label: string

  // ── Reactive State (Atoms) ───────────────────────────────

  /** Message list — the full conversation history */
  readonly messages$: Atom.Atom<ReadonlyArray<ChatMessage>>

  /** Connection lifecycle state */
  readonly connection$: Atom.Atom<ConnectionState>

  /** Current streaming state (buffer, progress) */
  readonly streaming$: Atom.Atom<StreamingState>

  /** Available agents (when multi-agent) */
  readonly agents$: Atom.Atom<ReadonlyArray<AgentInfo>>

  // ── Operations (Effects) ─────────────────────────────────

  /** Send a message. Adapter handles queuing, streaming, etc. */
  readonly send: (params: SendParams) => Effect.Effect<void>

  /** Cancel the current streaming response */
  readonly cancel: () => Effect.Effect<void>

  /** Reconnect after disconnect */
  readonly reconnect: () => Effect.Effect<void>

  /** Clear conversation history */
  readonly clear: () => Effect.Effect<void>

  // ── Optional Capabilities ────────────────────────────────

  /** Inline tasks atom — when the adapter provides agent task state.
   *  Shape: ReadonlyArray<ChatInlineTaskItem> from chat/msg/inline-task-types */
  readonly inlineTasks$?: Atom.Atom<ReadonlyArray<unknown>>

  /** Transfer system config (when surface participates in drag/drop) */
  readonly transferConfig?: TransferSurfaceConfig

  // ── Model Selection (Optional) ───────────────────────────

  /** Available models atom — when adapter supports model switching */
  readonly availableModels$?: Atom.Atom<ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly provider: string
    readonly description?: string
    readonly color?: string
  }>>

  /** Currently selected model ID */
  readonly selectedModel$?: Atom.Atom<string | null>

  /** Select a model — applies to next message */
  readonly selectModel?: (modelId: string) => void

  /** Status/interruption rows for inline banners (optional) */
  readonly statusRows$?: Atom.Atom<ReadonlyArray<{
    readonly id: string
    readonly tone: 'info' | 'warn' | 'error'
    readonly text: string
    readonly code?: string
    readonly details?: unknown
    readonly source?: 'harness' | 'mock' | 'surface'
  }>>

  /** Metrics from harness events (optional — only harness adapter provides) */
  readonly metrics$?: Atom.Atom<ReadonlyArray<unknown>>

  /** Provider marker (optional — only harness adapter provides) */
  readonly provider$?: Atom.Atom<unknown>

  /** Dispose adapter — cleanup subscriptions, close connections */
  readonly dispose: () => Effect.Effect<void>
}

// =============================================================================
// Adapter Factory Helpers
// =============================================================================

/**
 * Minimal config to create a mock adapter (for testbed / demos).
 */
export interface MockAdapterConfig {
  /** Pre-seeded messages */
  readonly initialMessages?: ReadonlyArray<ChatMessage>
  /** Simulated latency in ms */
  readonly latencyMs?: number
  /** Auto-respond with agent messages */
  readonly autoRespond?: boolean
  /** Auto-response delay in ms */
  readonly responseDelayMs?: number
}

/**
 * Config for a WebSocket-based adapter.
 */
export interface WebSocketAdapterConfig {
  /** WebSocket endpoint URL */
  readonly url: string
  /** Session/conversation ID */
  readonly sessionId: string
  /** Auth token */
  readonly authToken?: string
  /** Reconnect on disconnect */
  readonly autoReconnect?: boolean
  /** Max reconnect attempts */
  readonly maxReconnectAttempts?: number
}

/**
 * Config for a conductor-mode adapter (multi-agent orchestration).
 */
export interface ConductorAdapterConfig {
  /** Agent registry atom (from conductor system) */
  readonly agentRegistryAtom: Atom.Atom<ReadonlyArray<AgentInfo>>
  /** Task surface atom (from inline task system) */
  readonly taskSurfaceAtom?: Atom.Atom<unknown>
  /** Transfer cluster label */
  readonly transferClusterLabel?: string
}
