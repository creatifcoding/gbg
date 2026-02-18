/**
 * MorphChat Surface Machine (XState v5)
 *
 * Governs the surface lifecycle and spec morphing transitions.
 *
 * States: idle → active ⇄ morphing → error
 * Events: CONNECT, DISCONNECT, MORPH, MORPH_DONE, ERROR, RECOVER
 *
 * Pattern: same as morph-card/machines/islandMachine.ts
 *
 * @module morphchat/machines/surface-machine
 */

import { setup, assign } from 'xstate'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import {
  type TransitionGrammar,
  DEFAULT_TRANSITION,
  deriveGrammarByDelta,
} from '../../morph-card/schemas/transition-grammar'

// =============================================================================
// Types
// =============================================================================

export interface SurfaceMachineContext {
  /** Surface instance ID */
  surfaceId: string
  /** Current active spec */
  activeSpec: ChatSurfaceSpec
  /** Spec before current morph (null if no morph has occurred) */
  previousSpec: ChatSurfaceSpec | null
  /** Transition grammar for current morph animation */
  morphTransition: TransitionGrammar
  /** Target spec during morph (becomes activeSpec on MORPH_DONE) */
  morphTarget: ChatSurfaceSpec | null
  /** Error message */
  error: string | null
}

export type SurfaceMachineEvent =
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'MORPH'; targetSpec: ChatSurfaceSpec; trigger?: string }
  | { type: 'MORPH_DONE' }
  | { type: 'MORPH_CANCEL' }
  | { type: 'ERROR'; error: string }
  | { type: 'RECOVER' }

export interface SurfaceMachineInput {
  surfaceId: string
  initialSpec: ChatSurfaceSpec
}

// =============================================================================
// Spec → Layout Size Heuristic
// =============================================================================

/**
 * Estimate layout dimensions from a spec for transition grammar derivation.
 * We don't need pixel precision — just relative scale for the heuristic.
 */
function specToEstimatedSize(spec: ChatSurfaceSpec): { width: number; height: number } {
  let width = spec.maxWidth ?? 800
  let height = spec.maxHeight ?? 600

  // Adjust by feature complexity
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
  },
  actions: {
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
    applyMorphTarget: assign(({ context }) => ({
      activeSpec: context.morphTarget ?? context.activeSpec,
      morphTarget: null,
    })),
    clearMorphTarget: assign({
      morphTarget: null,
      morphTransition: DEFAULT_TRANSITION,
    }),
    assignError: assign(({ event }) => ({
      error: event.type === 'ERROR' ? event.error : null,
    })),
    clearError: assign({ error: null }),
  },
  guards: {
    hasValidMorphTarget: ({ event }) =>
      event.type === 'MORPH' && event.targetSpec != null,
    isSameSpec: ({ context, event }) =>
      event.type === 'MORPH' && event.targetSpec._tag === context.activeSpec._tag,
  },
}).createMachine({
  id: 'morphChatSurface',
  context: ({ input }) => ({
    surfaceId: input.surfaceId,
    activeSpec: input.initialSpec,
    previousSpec: null,
    morphTransition: DEFAULT_TRANSITION,
    morphTarget: null,
    error: null,
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        CONNECT: { target: 'active' },
        MORPH: {
          target: 'active',
          guard: 'hasValidMorphTarget',
          actions: ['assignMorphTarget', 'applyMorphTarget'],
        },
      },
    },
    active: {
      on: {
        MORPH: [
          {
            // Same spec — noop
            guard: 'isSameSpec',
          },
          {
            target: 'morphing',
            guard: 'hasValidMorphTarget',
            actions: 'assignMorphTarget',
          },
        ],
        DISCONNECT: { target: 'idle' },
        ERROR: {
          target: 'error',
          actions: 'assignError',
        },
      },
    },
    morphing: {
      on: {
        MORPH_DONE: {
          target: 'active',
          actions: 'applyMorphTarget',
        },
        MORPH_CANCEL: {
          target: 'active',
          actions: 'clearMorphTarget',
        },
        ERROR: {
          target: 'error',
          actions: ['clearMorphTarget', 'assignError'],
        },
      },
      // Auto-complete morph after timeout as safety net
      after: {
        3000: {
          target: 'active',
          actions: 'applyMorphTarget',
        },
      },
    },
    error: {
      on: {
        RECOVER: {
          target: 'active',
          actions: 'clearError',
        },
        DISCONNECT: { target: 'idle' },
      },
    },
  },
})
