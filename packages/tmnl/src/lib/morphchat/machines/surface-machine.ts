/**
 * MorphChat Surface Machine v2 (XState v5)
 *
 * Parallel-state orchestrator for the MorphChat surface lifecycle.
 *
 * Three independent parallel regions:
 *   connection  — idle → connecting → connected ⇄ reconnecting → error
 *   streaming   — idle ⇄ streaming → finalizing
 *   presentation — ready ⇄ morphing
 *
 * Events flow IN from:
 *   - React props (MORPH, SET_SPEC)
 *   - Adapter (ADAPTER_CONNECTED, ADAPTER_DISCONNECTED, STREAM_START, STREAM_DELTA, STREAM_END)
 *   - User (SEND, CANCEL, RECONNECT)
 *
 * The machine DRIVES:
 *   - Adapter connection lifecycle (invoke fromCallback)
 *   - ContentViewSpec derivation (assign on spec change)
 *   - Animation sequencing (delayed transitions in morphing)
 *   - Compound rendering gates (guards on streaming/connection state)
 *
 * @module morphchat/machines/surface-machine
 */

import { setup, assign, enqueueActions, sendParent, emit } from 'xstate'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import {
  type ContentViewSpec,
  deriveContentViewSpec,
} from '../schemas/content-view-spec'
import {
  type TransitionGrammar,
  DEFAULT_TRANSITION,
  deriveGrammarByDelta,
} from '../../morph-card/schemas/transition-grammar'

// =============================================================================
// Context
// =============================================================================

export interface SurfaceMachineContext {
  /** Surface instance ID */
  surfaceId: string

  /** Active surface spec */
  activeSpec: ChatSurfaceSpec

  /** Derived content view spec — drives compound density/adaptation */
  contentView: ContentViewSpec

  /** Previous spec (for morph animation) */
  previousSpec: ChatSurfaceSpec | null

  /** Transition grammar for morph animation */
  morphTransition: TransitionGrammar

  /** Target spec during morph */
  morphTarget: ChatSurfaceSpec | null

  /** Connection error message */
  connectionError: string | null

  /** Streaming message ID (null when not streaming) */
  streamingMessageId: string | null

  /** Count of messages received during current stream */
  streamDeltaCount: number

  /** Whether auto-collapse should fire (set true after stream completes) */
  shouldAutoCollapse: boolean

  /** Generic error */
  error: string | null
}

// =============================================================================
// Events
// =============================================================================

export type SurfaceMachineEvent =
  // ── Lifecycle ───────────────────────────────────────────
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'RECONNECT' }

  // ── Connection feedback ─────────────────────────────────
  | { type: 'ADAPTER_CONNECTED' }
  | { type: 'ADAPTER_DISCONNECTED'; reason?: string }
  | { type: 'ADAPTER_ERROR'; error: string }

  // ── Streaming ───────────────────────────────────────────
  | { type: 'STREAM_START'; messageId: string }
  | { type: 'STREAM_DELTA'; messageId: string }
  | { type: 'STREAM_END'; messageId: string }
  | { type: 'STREAM_ERROR'; messageId: string; error: string }

  // ── User actions ────────────────────────────────────────
  | { type: 'SEND'; content: string }
  | { type: 'CANCEL' }

  // ── Presentation / Morphing ─────────────────────────────
  | { type: 'MORPH'; targetSpec: ChatSurfaceSpec; trigger?: string }
  | { type: 'MORPH_DONE' }
  | { type: 'MORPH_CANCEL' }

  // ── Error recovery ──────────────────────────────────────
  | { type: 'ERROR'; error: string }
  | { type: 'RECOVER' }

// =============================================================================
// Emitted Events (for actor.on() listeners in React)
// =============================================================================

export type SurfaceEmittedEvent =
  | { type: 'surface.specChanged'; spec: ChatSurfaceSpec; contentView: ContentViewSpec }
  | { type: 'surface.connectionChanged'; status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error' }
  | { type: 'surface.streamingChanged'; isStreaming: boolean; messageId: string | null }
  | { type: 'surface.autoCollapse' }
  | { type: 'surface.morphStart'; from: ChatSurfaceSpec; to: ChatSurfaceSpec; grammar: TransitionGrammar }
  | { type: 'surface.morphEnd'; spec: ChatSurfaceSpec }

// =============================================================================
// Input
// =============================================================================

export interface SurfaceMachineInput {
  surfaceId: string
  initialSpec: ChatSurfaceSpec
}

// =============================================================================
// Spec → Layout Size Heuristic (for transition grammar)
// =============================================================================

function specToEstimatedSize(spec: ChatSurfaceSpec): { width: number; height: number } {
  let width = spec.maxWidth ?? 800
  let height = spec.maxHeight ?? 600

  if (spec.composer === 'none') height -= 80
  if (spec.composer === 'single-line') height -= 40
  if (spec.thread === 'none') height -= 300
  if (spec.thread === 'compact') height -= 100
  if (spec.frameChrome === 'none') { width -= 40; height -= 40 }
  if (spec.agentSelector === 'hidden') height -= 36
  if (spec.inlineTasks === 'hidden') height -= 60

  return { width: Math.max(width, 200), height: Math.max(height, 100) }
}

// =============================================================================
// Machine Definition
// =============================================================================

export const surfaceMachine = setup({
  types: {
    context: {} as SurfaceMachineContext,
    events: {} as SurfaceMachineEvent,
    input: {} as SurfaceMachineInput,
    emitted: {} as SurfaceEmittedEvent,
  },

  // ── Actions ─────────────────────────────────────────────
  actions: {
    // Spec management
    deriveContentView: assign(({ context }) => ({
      contentView: deriveContentViewSpec(context.activeSpec),
    })),

    emitSpecChanged: emit(({ context }) => ({
      type: 'surface.specChanged' as const,
      spec: context.activeSpec,
      contentView: context.contentView,
    })),

    // Morph management
    assignMorphTarget: assign(({ context, event }) => {
      if (event.type !== 'MORPH') return {}
      const fromSize = specToEstimatedSize(context.activeSpec)
      const toSize = specToEstimatedSize(event.targetSpec)
      const grammar = deriveGrammarByDelta({ from: fromSize, to: toSize })

      return {
        previousSpec: context.activeSpec,
        morphTarget: event.targetSpec,
        morphTransition: grammar,
      }
    }),

    emitMorphStart: emit(({ context }) => ({
      type: 'surface.morphStart' as const,
      from: context.activeSpec,
      to: context.morphTarget!,
      grammar: context.morphTransition,
    })),

    applyMorphTarget: assign(({ context }) => {
      const newSpec = context.morphTarget ?? context.activeSpec
      return {
        activeSpec: newSpec,
        contentView: deriveContentViewSpec(newSpec),
        morphTarget: null,
      }
    }),

    emitMorphEnd: emit(({ context }) => ({
      type: 'surface.morphEnd' as const,
      spec: context.activeSpec,
    })),

    clearMorphTarget: assign({
      morphTarget: null,
      morphTransition: DEFAULT_TRANSITION,
    }),

    // Connection management
    assignConnectionError: assign(({ event }) => ({
      connectionError: event.type === 'ADAPTER_ERROR' ? event.error
        : event.type === 'ADAPTER_DISCONNECTED' ? (event.reason ?? 'disconnected')
        : null,
    })),

    clearConnectionError: assign({ connectionError: null }),

    emitConnectionChanged: emit(({ }) => ({
      type: 'surface.connectionChanged' as const,
      status: 'connected' as const,
    })),

    // Streaming management
    assignStreamStart: assign(({ event }) => ({
      streamingMessageId: event.type === 'STREAM_START' ? event.messageId : null,
      streamDeltaCount: 0,
      shouldAutoCollapse: false,
    })),

    incrementDeltaCount: assign(({ context }) => ({
      streamDeltaCount: context.streamDeltaCount + 1,
    })),

    clearStream: assign({
      streamingMessageId: null,
      streamDeltaCount: 0,
    }),

    markAutoCollapse: assign({ shouldAutoCollapse: true }),

    emitAutoCollapse: emit({ type: 'surface.autoCollapse' as const }),

    emitStreamingChanged: emit(({ context }) => ({
      type: 'surface.streamingChanged' as const,
      isStreaming: context.streamingMessageId !== null,
      messageId: context.streamingMessageId,
    })),

    // Error management
    assignError: assign(({ event }) => ({
      error: event.type === 'ERROR' ? event.error : null,
    })),
    clearError: assign({ error: null }),
  },

  // ── Guards ──────────────────────────────────────────────
  guards: {
    hasValidMorphTarget: ({ event }) =>
      event.type === 'MORPH' && event.targetSpec != null,

    isSameSpec: ({ context, event }) =>
      event.type === 'MORPH' && event.targetSpec._tag === context.activeSpec._tag,

    isConnected: ({ context }) =>
      context.connectionError === null,

    isStreaming: ({ context }) =>
      context.streamingMessageId !== null,

    shouldAutoCollapse: ({ context }) =>
      context.contentView.autoCollapse,

    hasInteractivity: ({ context }) =>
      context.contentView.interactivity.expandCollapse,
  },

  // ── Delays ──────────────────────────────────────────────
  delays: {
    /** Morph animation duration — derived from transition grammar */
    morphDuration: ({ context }) => {
      const d = context.morphTransition.duration
      return typeof d === 'number' ? d : 300
    },

    /** Auto-collapse delay after streaming completes */
    autoCollapseDelay: 500,

    /** Reconnect backoff */
    reconnectDelay: 2000,

    /** Safety timeout for morphs that never complete */
    morphSafetyTimeout: 3000,
  },

}).createMachine({
  id: 'morphChatSurface',

  context: ({ input }) => ({
    surfaceId: input.surfaceId,
    activeSpec: input.initialSpec,
    contentView: deriveContentViewSpec(input.initialSpec),
    previousSpec: null,
    morphTransition: DEFAULT_TRANSITION,
    morphTarget: null,
    connectionError: null,
    streamingMessageId: null,
    streamDeltaCount: 0,
    shouldAutoCollapse: false,
    error: null,
  }),

  // ═══════════════════════════════════════════════════════════
  // Top-level: PARALLEL regions
  // ═══════════════════════════════════════════════════════════
  type: 'parallel',

  states: {
    // ─────────────────────────────────────────────────────────
    // REGION 1: Connection Lifecycle
    // ─────────────────────────────────────────────────────────
    connection: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            CONNECT: { target: 'connecting' },
          },
        },

        connecting: {
          on: {
            ADAPTER_CONNECTED: {
              target: 'connected',
              actions: ['clearConnectionError'],
            },
            ADAPTER_ERROR: {
              target: 'error',
              actions: ['assignConnectionError'],
            },
            DISCONNECT: { target: 'idle' },
          },
        },

        connected: {
          on: {
            ADAPTER_DISCONNECTED: {
              target: 'reconnecting',
              actions: ['assignConnectionError'],
            },
            ADAPTER_ERROR: {
              target: 'error',
              actions: ['assignConnectionError'],
            },
            DISCONNECT: { target: 'disconnecting' },
          },
        },

        reconnecting: {
          after: {
            reconnectDelay: { target: 'connecting' },
          },
          on: {
            ADAPTER_CONNECTED: {
              target: 'connected',
              actions: ['clearConnectionError'],
            },
            DISCONNECT: { target: 'idle' },
            RECONNECT: { target: 'connecting' },
          },
        },

        disconnecting: {
          on: {
            ADAPTER_DISCONNECTED: { target: 'idle' },
          },
          after: {
            // Safety: if adapter doesn't confirm disconnect in 2s, force idle
            2000: { target: 'idle' },
          },
        },

        error: {
          on: {
            RECONNECT: { target: 'connecting' },
            RECOVER: {
              target: 'idle',
              actions: ['clearConnectionError'],
            },
            DISCONNECT: { target: 'idle' },
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────
    // REGION 2: Streaming Lifecycle
    // ─────────────────────────────────────────────────────────
    streaming: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            STREAM_START: {
              target: 'active',
              actions: ['assignStreamStart'],
            },
          },
        },

        active: {
          on: {
            STREAM_DELTA: {
              actions: ['incrementDeltaCount'],
            },
            STREAM_END: {
              target: 'finalizing',
              actions: ['markAutoCollapse'],
            },
            STREAM_ERROR: {
              target: 'idle',
              actions: ['clearStream'],
            },
            CANCEL: {
              target: 'idle',
              actions: ['clearStream'],
            },
          },
        },

        finalizing: {
          // Brief delay for final render + auto-collapse trigger
          after: {
            autoCollapseDelay: {
              target: 'idle',
              guard: 'shouldAutoCollapse',
              actions: ['emitAutoCollapse', 'clearStream'],
            },
          },
          // If no auto-collapse, just clear immediately
          always: {
            target: 'idle',
            guard: ({ context }) => !context.contentView.autoCollapse,
            actions: ['clearStream'],
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────
    // REGION 3: Presentation / Morphing
    // ─────────────────────────────────────────────────────────
    presentation: {
      initial: 'ready',
      states: {
        ready: {
          on: {
            MORPH: [
              { guard: 'isSameSpec' }, // noop for same spec
              {
                target: 'morphing',
                guard: 'hasValidMorphTarget',
                actions: ['assignMorphTarget', 'emitMorphStart'],
              },
            ],
          },
        },

        morphing: {
          after: {
            // Animation completes after grammar-derived duration
            morphDuration: {
              target: 'settling',
              actions: ['applyMorphTarget', 'emitMorphEnd'],
            },
            // Safety: never stay in morphing forever
            morphSafetyTimeout: {
              target: 'ready',
              actions: ['applyMorphTarget', 'emitMorphEnd'],
            },
          },
          on: {
            MORPH_DONE: {
              target: 'settling',
              actions: ['applyMorphTarget', 'emitMorphEnd'],
            },
            MORPH_CANCEL: {
              target: 'ready',
              actions: ['clearMorphTarget'],
            },
            // Interruptible: new MORPH during morphing
            MORPH: [
              { guard: 'isSameSpec' },
              {
                target: 'morphing',
                guard: 'hasValidMorphTarget',
                actions: ['applyMorphTarget', 'assignMorphTarget', 'emitMorphStart'],
                reenter: true,
              },
            ],
          },
        },

        settling: {
          // Brief settle period for React to rerender at new density
          after: {
            100: {
              target: 'ready',
              actions: ['emitSpecChanged'],
            },
          },
        },
      },
    },
  },
})
