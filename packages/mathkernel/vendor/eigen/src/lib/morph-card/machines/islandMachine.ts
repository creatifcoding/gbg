/**
 * Dynamic Island Machine (MorphCard)
 *
 * XState v5 machine for sizeKey transitions, reticle feedback,
 * and drag/resize lifecycle coordination.
 *
 * @module morph-card/machines/islandMachine
 */

import { setup, assign } from 'xstate';
import { Effect } from 'effect';
import {
  DEFAULT_TRANSITION,
  TransitionGrammar,
  parseGrammar,
  deriveGrammarByDelta,
} from '../schemas/transition-grammar';
import { ReticleVariant } from '../schemas/animation-config';
import type { Position, Bounds, TransitionComplexity } from '../card-state';

// =============================================================================
// Types
// =============================================================================

export interface IslandMachineContext {
  sizeKey: string;
  previousSizeKey: string;
  basePosition: Position;
  position: Position;
  reticle: ReticleVariant;
  activeTransition: TransitionGrammar;
  complexity: TransitionComplexity;
  bounds: Bounds;
  isDragging: boolean;
  isResizing: boolean;
  shiftKey: boolean;
}

export type IslandMachineEvent =
  | {
      type: 'TRANSITION';
      sizeKey: string;
      grammar?: TransitionGrammar;
      reticle?: ReticleVariant;
      complexity?: TransitionComplexity;
    }
  | { type: 'INTERMEDIATE_TRANSITION'; grammar: TransitionGrammar }
  | { type: 'SET_RETICLE'; reticle: ReticleVariant }
  | { type: 'SET_COMPLEXITY'; complexity: TransitionComplexity }
  | { type: 'SET_POSITION'; position: Position }
  | { type: 'SET_BASE_POSITION'; basePosition: Position }
  | { type: 'RESET_POSITION' }
  | { type: 'BOUNDS_UPDATE'; bounds: Bounds }
  | { type: 'DRAG_START'; shiftKey?: boolean; pointer?: Position }
  | { type: 'DRAG_END' }
  | { type: 'RESIZE_START' }
  | { type: 'RESIZE_END' }
  | { type: 'RETICLE_DONE' }
  | { type: 'MORPH_DONE' };

export interface TransitionStrategyInput {
  readonly from: string;
  readonly to: string;
  readonly current: TransitionGrammar;
  readonly complexity: TransitionComplexity;
  readonly sizes?: Record<string, { width: number; height: number }>;
}

export type TransitionStrategy = (
  input: TransitionStrategyInput
) => Effect.Effect<ReadonlyArray<TransitionGrammar>>;

export const defaultTransitionStrategy: TransitionStrategy = (input) => {
  const sizes = input.sizes;
  if (sizes && sizes[input.from] && sizes[input.to]) {
    return Effect.succeed([
      deriveGrammarByDelta({ from: sizes[input.from], to: sizes[input.to] }),
    ]);
  }
  return Effect.succeed([input.current ?? DEFAULT_TRANSITION]);
};

// =============================================================================
// Timings
// =============================================================================

const TIMING = {
  reticle: 120,
  morph: 240,
};

// =============================================================================
// Machine
// =============================================================================

export const islandMachine = setup({
  types: {
    context: {} as IslandMachineContext,
    events: {} as IslandMachineEvent,
  },
  actions: {
    applyTransition: assign({
      previousSizeKey: ({ context }) => context.sizeKey,
      sizeKey: ({ event, context }) =>
        event.type === 'TRANSITION' ? event.sizeKey : context.sizeKey,
      activeTransition: ({ event, context }) => {
        if (event.type === 'TRANSITION' && event.grammar) {
          return parseGrammar(event.grammar as any);
        }
        if (event.type === 'INTERMEDIATE_TRANSITION') {
          return parseGrammar(event.grammar as any);
        }
        return context.activeTransition;
      },
      reticle: ({ event, context }) =>
        event.type === 'TRANSITION' && event.reticle ? event.reticle : context.reticle,
      complexity: ({ event, context }) =>
        event.type === 'TRANSITION' && event.complexity ? event.complexity : context.complexity,
    }),
    setReticle: assign({
      reticle: ({ event, context }) =>
        event.type === 'SET_RETICLE' ? event.reticle : context.reticle,
    }),
    setComplexity: assign({
      complexity: ({ event, context }) =>
        event.type === 'SET_COMPLEXITY' ? event.complexity : context.complexity,
    }),
    setPosition: assign({
      position: ({ event, context }) =>
        event.type === 'SET_POSITION' ? event.position : context.position,
    }),
    setBasePosition: assign({
      basePosition: ({ event, context }) =>
        event.type === 'SET_BASE_POSITION' ? event.basePosition : context.basePosition,
    }),
    resetPosition: assign({
      position: ({ context }) => context.basePosition,
    }),
    updateBounds: assign({
      bounds: ({ event, context }) =>
        event.type === 'BOUNDS_UPDATE' ? event.bounds : context.bounds,
    }),
    startDrag: assign({
      isDragging: () => true,
      shiftKey: ({ event, context }) =>
        event.type === 'DRAG_START' && typeof event.shiftKey === 'boolean'
          ? event.shiftKey
          : context.shiftKey,
    }),
    endDrag: assign({
      isDragging: () => false,
      shiftKey: () => false,
    }),
    startResize: assign({
      isResizing: () => true,
    }),
    endResize: assign({
      isResizing: () => false,
    }),
  },
  guards: {
    isComplex: ({ context, event }) => {
      if (event.type === 'TRANSITION' && event.complexity) {
        return event.complexity === 'complex';
      }
      return context.complexity === 'complex';
    },
  },
}).createMachine({
  id: 'morphCardIsland',
  initial: 'idle',
  context: ({ input }: { input?: Partial<IslandMachineContext> }) => ({
    sizeKey: input?.sizeKey ?? 'default',
    previousSizeKey: input?.previousSizeKey ?? 'default',
    basePosition: input?.basePosition ?? { x: 0, y: 0 },
    position: input?.position ?? { x: 0, y: 0 },
    reticle: input?.reticle ?? 'corners',
    activeTransition: input?.activeTransition ?? DEFAULT_TRANSITION,
    complexity: input?.complexity ?? 'simple',
    bounds: input?.bounds ?? {},
    isDragging: input?.isDragging ?? false,
    isResizing: input?.isResizing ?? false,
    shiftKey: input?.shiftKey ?? false,
  }),
  states: {
    idle: {
      on: {
        TRANSITION: [
          {
            guard: 'isComplex',
            target: 'reticleActive',
            actions: 'applyTransition',
          },
          {
            target: 'morphing',
            actions: 'applyTransition',
          },
        ],
        INTERMEDIATE_TRANSITION: { actions: 'applyTransition' },
        SET_RETICLE: { actions: 'setReticle' },
        SET_COMPLEXITY: { actions: 'setComplexity' },
        SET_POSITION: { actions: 'setPosition' },
        SET_BASE_POSITION: { actions: 'setBasePosition' },
        RESET_POSITION: { actions: 'resetPosition' },
        BOUNDS_UPDATE: { actions: 'updateBounds' },
        DRAG_START: { target: 'dragging', actions: 'startDrag' },
        RESIZE_START: { target: 'resizing', actions: 'startResize' },
      },
    },
    reticleActive: {
      after: {
        [TIMING.reticle]: { target: 'morphing' },
      },
      on: {
        TRANSITION: {
          target: 'reticleActive',
          actions: 'applyTransition',
        },
        INTERMEDIATE_TRANSITION: { actions: 'applyTransition' },
        SET_RETICLE: { actions: 'setReticle' },
        SET_COMPLEXITY: { actions: 'setComplexity' },
      },
    },
    morphing: {
      after: {
        [TIMING.morph]: { target: 'idle' },
      },
      on: {
        TRANSITION: [
          {
            guard: 'isComplex',
            target: 'reticleActive',
            actions: 'applyTransition',
          },
          {
            target: 'morphing',
            actions: 'applyTransition',
          },
        ],
        INTERMEDIATE_TRANSITION: { actions: 'applyTransition' },
        SET_RETICLE: { actions: 'setReticle' },
        SET_COMPLEXITY: { actions: 'setComplexity' },
        DRAG_START: { target: 'dragging', actions: 'startDrag' },
        RESIZE_START: { target: 'resizing', actions: 'startResize' },
      },
    },
    dragging: {
      on: {
        SET_POSITION: { actions: 'setPosition' },
        DRAG_END: { target: 'idle', actions: 'endDrag' },
      },
    },
    resizing: {
      on: {
        RESIZE_END: { target: 'idle', actions: 'endResize' },
      },
    },
  },
});

export type IslandMachine = typeof islandMachine;
