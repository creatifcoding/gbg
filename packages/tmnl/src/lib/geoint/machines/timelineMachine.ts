/**
 * Timeline Playback XState Machine
 *
 * State machine for temporal playback orchestration:
 * - Play/pause/stop state management
 * - Speed control with presets
 * - Loop mode with configurable behavior
 * - Keyboard shortcut integration
 * - Range clamping and boundary detection
 *
 * This machine coordinates UI state while TimelinePanel atoms handle data.
 *
 * @module geoint/machines/timelineMachine
 */

import { setup, assign, emit, raise } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type TimelineSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8 | 16

export type LoopMode = 'none' | 'loop' | 'bounce'

export interface TimelineRange {
  start: Date
  end: Date
}

export interface TimelinePlaybackContext {
  /** Current playhead position (ms since epoch) */
  playhead: number
  /** Time range (ms since epoch) */
  rangeStart: number
  rangeEnd: number
  /** Playback speed multiplier */
  speed: TimelineSpeed
  /** Loop mode */
  loopMode: LoopMode
  /** Direction for bounce mode */
  bounceDirection: 'forward' | 'reverse'
  /** Step size in ms (for discrete stepping) */
  stepSize: number
  /** Whether keyboard shortcuts are enabled */
  keyboardEnabled: boolean
  /** Last update timestamp for delta calculation */
  lastUpdateTime: number
}

export type TimelinePlaybackEvent =
  // Playback control
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'TOGGLE' }

  // Speed control
  | { type: 'SET_SPEED'; speed: TimelineSpeed }
  | { type: 'SPEED_UP' }
  | { type: 'SPEED_DOWN' }

  // Position control
  | { type: 'SEEK'; position: number }
  | { type: 'SEEK_PERCENT'; percent: number }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'JUMP_START' }
  | { type: 'JUMP_END' }

  // Range control
  | { type: 'SET_RANGE'; start: number; end: number }

  // Loop control
  | { type: 'SET_LOOP_MODE'; mode: LoopMode }
  | { type: 'TOGGLE_LOOP' }

  // Internal events
  | { type: 'TICK' }
  | { type: 'REACHED_END' }
  | { type: 'REACHED_START' }

  // Keyboard
  | { type: 'ENABLE_KEYBOARD' }
  | { type: 'DISABLE_KEYBOARD' }
  | { type: 'KEYBOARD_SHORTCUT'; key: string }

export type TimelinePlaybackEmittedEvent =
  | { type: 'onPlayheadChange'; position: number; time: Date }
  | { type: 'onRangeChange'; start: number; end: number }
  | { type: 'onPlaybackStateChange'; playing: boolean }
  | { type: 'onSpeedChange'; speed: TimelineSpeed }
  | { type: 'onLoopModeChange'; mode: LoopMode }
  | { type: 'onReachedBoundary'; boundary: 'start' | 'end' }

export interface TimelinePlaybackInput {
  initialPlayhead?: number
  initialRange?: TimelineRange
  initialSpeed?: TimelineSpeed
  initialLoopMode?: LoopMode
  stepSize?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SPEED_OPTIONS: readonly TimelineSpeed[] = [0.25, 0.5, 1, 2, 4, 8, 16]

const DEFAULT_STEP_SIZE = 60 * 1000 // 1 minute

// =============================================================================
// HELPERS
// =============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getNextSpeed(current: TimelineSpeed, direction: 'up' | 'down'): TimelineSpeed {
  const currentIndex = SPEED_OPTIONS.indexOf(current)
  if (direction === 'up') {
    return SPEED_OPTIONS[Math.min(currentIndex + 1, SPEED_OPTIONS.length - 1)]
  }
  return SPEED_OPTIONS[Math.max(currentIndex - 1, 0)]
}

// =============================================================================
// MACHINE
// =============================================================================

export const timelinePlaybackMachine = setup({
  types: {
    context: {} as TimelinePlaybackContext,
    events: {} as TimelinePlaybackEvent,
    emitted: {} as TimelinePlaybackEmittedEvent,
    input: {} as TimelinePlaybackInput,
  },
  actions: {
    // Playhead manipulation
    setPlayhead: assign(({ context, event }) => {
      if (event.type !== 'SEEK') return context
      return {
        playhead: clamp(event.position, context.rangeStart, context.rangeEnd),
      }
    }),

    setPlayheadPercent: assign(({ context, event }) => {
      if (event.type !== 'SEEK_PERCENT') return context
      const range = context.rangeEnd - context.rangeStart
      const position = context.rangeStart + range * (event.percent / 100)
      return {
        playhead: clamp(position, context.rangeStart, context.rangeEnd),
      }
    }),

    stepForward: assign(({ context }) => ({
      playhead: clamp(context.playhead + context.stepSize, context.rangeStart, context.rangeEnd),
    })),

    stepBackward: assign(({ context }) => ({
      playhead: clamp(context.playhead - context.stepSize, context.rangeStart, context.rangeEnd),
    })),

    jumpToStart: assign(({ context }) => ({
      playhead: context.rangeStart,
    })),

    jumpToEnd: assign(({ context }) => ({
      playhead: context.rangeEnd,
    })),

    // Range manipulation
    setRange: assign(({ event }) => {
      if (event.type !== 'SET_RANGE') return {}
      return {
        rangeStart: event.start,
        rangeEnd: event.end,
      }
    }),

    // Speed manipulation
    setSpeed: assign(({ event }) => {
      if (event.type !== 'SET_SPEED') return {}
      return { speed: event.speed }
    }),

    speedUp: assign(({ context }) => ({
      speed: getNextSpeed(context.speed, 'up'),
    })),

    speedDown: assign(({ context }) => ({
      speed: getNextSpeed(context.speed, 'down'),
    })),

    // Loop manipulation
    setLoopMode: assign(({ event }) => {
      if (event.type !== 'SET_LOOP_MODE') return {}
      return { loopMode: event.mode }
    }),

    toggleLoop: assign(({ context }) => {
      const modes: LoopMode[] = ['none', 'loop', 'bounce']
      const currentIndex = modes.indexOf(context.loopMode)
      return {
        loopMode: modes[(currentIndex + 1) % modes.length],
      }
    }),

    // Playback tick (called by interval)
    advancePlayhead: assign(({ context }) => {
      const now = Date.now()
      const delta = now - context.lastUpdateTime
      const advancement = delta * context.speed * (context.bounceDirection === 'reverse' ? -1 : 1)
      const newPlayhead = context.playhead + advancement

      return {
        playhead: clamp(newPlayhead, context.rangeStart, context.rangeEnd),
        lastUpdateTime: now,
      }
    }),

    // Bounce direction toggle
    reverseDirection: assign(({ context }) => ({
      bounceDirection: context.bounceDirection === 'forward' ? 'reverse' as const : 'forward' as const,
    })),

    // Reset for stop
    resetPlayhead: assign(({ context }) => ({
      playhead: context.rangeStart,
      bounceDirection: 'forward' as const,
    })),

    // Update timestamp
    updateTimestamp: assign({
      lastUpdateTime: () => Date.now(),
    }),

    // Keyboard state
    enableKeyboard: assign({ keyboardEnabled: true }),
    disableKeyboard: assign({ keyboardEnabled: false }),

    // Emitters
    emitPlayheadChange: emit(({ context }) => ({
      type: 'onPlayheadChange' as const,
      position: context.playhead,
      time: new Date(context.playhead),
    })),

    emitRangeChange: emit(({ context }) => ({
      type: 'onRangeChange' as const,
      start: context.rangeStart,
      end: context.rangeEnd,
    })),

    emitPlaybackStateChange: emit(() => ({
      type: 'onPlaybackStateChange' as const,
      playing: false, // Will be overridden in states
    })),

    emitSpeedChange: emit(({ context }) => ({
      type: 'onSpeedChange' as const,
      speed: context.speed,
    })),

    emitLoopModeChange: emit(({ context }) => ({
      type: 'onLoopModeChange' as const,
      mode: context.loopMode,
    })),

    emitReachedEnd: emit({
      type: 'onReachedBoundary' as const,
      boundary: 'end' as const,
    }),

    emitReachedStart: emit({
      type: 'onReachedBoundary' as const,
      boundary: 'start' as const,
    }),
  },
  guards: {
    isAtEnd: ({ context }) => context.playhead >= context.rangeEnd,
    isAtStart: ({ context }) => context.playhead <= context.rangeStart,
    shouldLoop: ({ context }) => context.loopMode === 'loop',
    shouldBounce: ({ context }) => context.loopMode === 'bounce',
    isGoingForward: ({ context }) => context.bounceDirection === 'forward',
    isGoingReverse: ({ context }) => context.bounceDirection === 'reverse',
    isKeyboardEnabled: ({ context }) => context.keyboardEnabled,
  },
}).createMachine({
  id: 'timelinePlayback',
  initial: 'stopped',
  context: ({ input }) => {
    const now = Date.now()
    const defaultRange = {
      start: now - 24 * 60 * 60 * 1000, // 24 hours ago
      end: now,
    }
    return {
      playhead: input?.initialPlayhead ?? input?.initialRange?.start.getTime() ?? defaultRange.start,
      rangeStart: input?.initialRange?.start.getTime() ?? defaultRange.start,
      rangeEnd: input?.initialRange?.end.getTime() ?? defaultRange.end,
      speed: input?.initialSpeed ?? 1,
      loopMode: input?.initialLoopMode ?? 'none',
      bounceDirection: 'forward',
      stepSize: input?.stepSize ?? DEFAULT_STEP_SIZE,
      keyboardEnabled: true,
      lastUpdateTime: now,
    }
  },
  on: {
    // Global events (available in all states)
    SET_RANGE: {
      actions: ['setRange', 'emitRangeChange'],
    },
    SET_SPEED: {
      actions: ['setSpeed', 'emitSpeedChange'],
    },
    SPEED_UP: {
      actions: ['speedUp', 'emitSpeedChange'],
    },
    SPEED_DOWN: {
      actions: ['speedDown', 'emitSpeedChange'],
    },
    SET_LOOP_MODE: {
      actions: ['setLoopMode', 'emitLoopModeChange'],
    },
    TOGGLE_LOOP: {
      actions: ['toggleLoop', 'emitLoopModeChange'],
    },
    ENABLE_KEYBOARD: {
      actions: 'enableKeyboard',
    },
    DISABLE_KEYBOARD: {
      actions: 'disableKeyboard',
    },
    KEYBOARD_SHORTCUT: [
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === ' ',
        actions: raise({ type: 'TOGGLE' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === 'ArrowRight',
        actions: raise({ type: 'STEP_FORWARD' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === 'ArrowLeft',
        actions: raise({ type: 'STEP_BACKWARD' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === 'Home',
        actions: raise({ type: 'JUMP_START' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === 'End',
        actions: raise({ type: 'JUMP_END' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === '+',
        actions: raise({ type: 'SPEED_UP' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === '-',
        actions: raise({ type: 'SPEED_DOWN' }),
      },
      {
        guard: ({ context, event }) =>
          context.keyboardEnabled && event.key === 'l',
        actions: raise({ type: 'TOGGLE_LOOP' }),
      },
    ],
  },
  states: {
    stopped: {
      entry: emit({ type: 'onPlaybackStateChange' as const, playing: false }),
      on: {
        PLAY: {
          target: 'playing',
          actions: 'updateTimestamp',
        },
        TOGGLE: {
          target: 'playing',
          actions: 'updateTimestamp',
        },
        SEEK: {
          actions: ['setPlayhead', 'emitPlayheadChange'],
        },
        SEEK_PERCENT: {
          actions: ['setPlayheadPercent', 'emitPlayheadChange'],
        },
        STEP_FORWARD: {
          actions: ['stepForward', 'emitPlayheadChange'],
        },
        STEP_BACKWARD: {
          actions: ['stepBackward', 'emitPlayheadChange'],
        },
        JUMP_START: {
          actions: ['jumpToStart', 'emitPlayheadChange'],
        },
        JUMP_END: {
          actions: ['jumpToEnd', 'emitPlayheadChange'],
        },
      },
    },

    playing: {
      entry: emit({ type: 'onPlaybackStateChange' as const, playing: true }),
      after: {
        // Tick every 50ms for smooth playback
        50: {
          target: 'playing',
          actions: ['advancePlayhead', 'emitPlayheadChange'],
          reenter: true,
        },
      },
      always: [
        // Check for boundary conditions
        {
          guard: 'isAtEnd',
          actions: raise({ type: 'REACHED_END' }),
        },
        {
          guard: 'isAtStart',
          actions: raise({ type: 'REACHED_START' }),
        },
      ],
      on: {
        PAUSE: 'paused',
        STOP: {
          target: 'stopped',
          actions: 'resetPlayhead',
        },
        TOGGLE: 'paused',
        SEEK: {
          actions: ['setPlayhead', 'emitPlayheadChange'],
        },
        SEEK_PERCENT: {
          actions: ['setPlayheadPercent', 'emitPlayheadChange'],
        },
        REACHED_END: [
          {
            guard: 'shouldLoop',
            actions: ['jumpToStart', 'emitPlayheadChange', 'emitReachedEnd'],
          },
          {
            guard: 'shouldBounce',
            actions: ['reverseDirection', 'emitReachedEnd'],
          },
          {
            target: 'paused',
            actions: 'emitReachedEnd',
          },
        ],
        REACHED_START: [
          {
            guard: ({ context }) => context.loopMode === 'bounce' && context.bounceDirection === 'reverse',
            actions: ['reverseDirection', 'emitReachedStart'],
          },
        ],
      },
    },

    paused: {
      entry: emit({ type: 'onPlaybackStateChange' as const, playing: false }),
      on: {
        PLAY: {
          target: 'playing',
          actions: 'updateTimestamp',
        },
        STOP: {
          target: 'stopped',
          actions: 'resetPlayhead',
        },
        TOGGLE: {
          target: 'playing',
          actions: 'updateTimestamp',
        },
        SEEK: {
          actions: ['setPlayhead', 'emitPlayheadChange'],
        },
        SEEK_PERCENT: {
          actions: ['setPlayheadPercent', 'emitPlayheadChange'],
        },
        STEP_FORWARD: {
          actions: ['stepForward', 'emitPlayheadChange'],
        },
        STEP_BACKWARD: {
          actions: ['stepBackward', 'emitPlayheadChange'],
        },
        JUMP_START: {
          actions: ['jumpToStart', 'emitPlayheadChange'],
        },
        JUMP_END: {
          actions: ['jumpToEnd', 'emitPlayheadChange'],
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type TimelinePlaybackMachine = typeof timelinePlaybackMachine
export type TimelinePlaybackSnapshot = ReturnType<typeof timelinePlaybackMachine.getInitialSnapshot>
