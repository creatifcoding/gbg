/**
 * Control Mode XState Machine — governs who owns terminal stdin
 *
 * Three states:
 *   - agentControlled: Agent writes freely, human input triggers takeover (or blocked)
 *   - humanControlled: Human writes freely, agent writes rejected with message
 *   - supervised: Agent runs, human can interrupt by typing, auto-yields back after idle
 *
 * Context tracks controller role, timestamps, and auto-yield timer config.
 *
 * @module harness/interactive-shell/control-machine
 */

import { setup, assign, type ActorRefFrom, type SnapshotFrom } from 'xstate'
import type { ControlMode, ControllerRole } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Machine Context
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlMachineContext {
  /** Who currently holds stdin */
  controller: ControllerRole
  /** Current mode label (mirrors state name for atom projection) */
  mode: ControlMode
  /** When the current controller took over */
  controllerSince: number
  /** Last time the agent wrote to the PTY */
  lastAgentWriteAt: number
  /** Last time the human typed */
  lastHumanKeystrokeAt: number
  /** How long (ms) after last human keystroke before auto-yielding back to agent in supervised mode */
  autoYieldDelayMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine Events
// ─────────────────────────────────────────────────────────────────────────────

export type ControlMachineEvent =
  | { type: 'TAKE_OVER' }
  | { type: 'YIELD_BACK' }
  | { type: 'AGENT_WRITE'; timestamp: number }
  | { type: 'HUMAN_KEYSTROKE'; timestamp: number }
  | { type: 'SWITCH_MODE'; mode: ControlMode }
  | { type: 'AUTO_YIELD_TIMEOUT' }
  | { type: 'SESSION_ENDED' }

// ─────────────────────────────────────────────────────────────────────────────
// Machine Definition
// ─────────────────────────────────────────────────────────────────────────────

export const controlMachine = setup({
  types: {
    context: {} as ControlMachineContext,
    events: {} as ControlMachineEvent,
  },
  guards: {
    isAlive: () => true, // Overridden per-actor; session must be running
  },
  delays: {
    autoYieldDelay: ({ context }) => context.autoYieldDelayMs,
  },
}).createMachine({
  id: 'shellControl',
  initial: 'agentControlled',
  context: {
    controller: 'agent' as ControllerRole,
    mode: 'agent-controlled' as ControlMode,
    controllerSince: Date.now(),
    lastAgentWriteAt: 0,
    lastHumanKeystrokeAt: 0,
    autoYieldDelayMs: 5000,
  },
  states: {
    // ── Agent-Controlled ──────────────────────────────────────────────
    agentControlled: {
      entry: assign({
        controller: 'agent' as ControllerRole,
        mode: 'agent-controlled' as ControlMode,
        controllerSince: () => Date.now(),
      }),
      on: {
        TAKE_OVER: { target: 'humanControlled' },
        AGENT_WRITE: {
          actions: assign({ lastAgentWriteAt: ({ event }) => event.timestamp }),
        },
        HUMAN_KEYSTROKE: {
          // In agent-controlled mode, human keystroke = takeover request
          target: 'humanControlled',
          actions: assign({ lastHumanKeystrokeAt: ({ event }) => event.timestamp }),
        },
        SWITCH_MODE: [
          { guard: ({ event }) => event.mode === 'human-controlled', target: 'humanControlled' },
          { guard: ({ event }) => event.mode === 'supervised', target: 'supervised' },
        ],
        SESSION_ENDED: { target: 'ended' },
      },
    },

    // ── Human-Controlled ──────────────────────────────────────────────
    humanControlled: {
      entry: assign({
        controller: 'human' as ControllerRole,
        mode: 'human-controlled' as ControlMode,
        controllerSince: () => Date.now(),
      }),
      on: {
        YIELD_BACK: { target: 'agentControlled' },
        HUMAN_KEYSTROKE: {
          actions: assign({ lastHumanKeystrokeAt: ({ event }) => event.timestamp }),
        },
        // Agent writes are blocked in human-controlled — no transition, no action
        // (caller checks machine state before writing)
        SWITCH_MODE: [
          { guard: ({ event }) => event.mode === 'agent-controlled', target: 'agentControlled' },
          { guard: ({ event }) => event.mode === 'supervised', target: 'supervised' },
        ],
        SESSION_ENDED: { target: 'ended' },
      },
    },

    // ── Supervised ────────────────────────────────────────────────────
    supervised: {
      entry: assign({
        mode: 'supervised' as ControlMode,
        controllerSince: () => Date.now(),
        // Default controller is agent in supervised mode
        controller: 'agent' as ControllerRole,
      }),
      initial: 'agentRunning',
      states: {
        agentRunning: {
          entry: assign({ controller: 'agent' as ControllerRole }),
          on: {
            AGENT_WRITE: {
              actions: assign({ lastAgentWriteAt: ({ event }) => event.timestamp }),
            },
            HUMAN_KEYSTROKE: {
              target: 'humanOverride',
              actions: assign({ lastHumanKeystrokeAt: ({ event }) => event.timestamp }),
            },
          },
        },
        humanOverride: {
          entry: assign({ controller: 'human' as ControllerRole }),
          after: {
            autoYieldDelay: {
              target: 'agentRunning',
            },
          },
          on: {
            HUMAN_KEYSTROKE: {
              // Reset the auto-yield timer on each keystroke
              target: 'humanOverride',
              reenter: true,
              actions: assign({ lastHumanKeystrokeAt: ({ event }) => event.timestamp }),
            },
            YIELD_BACK: { target: 'agentRunning' },
          },
        },
      },
      on: {
        TAKE_OVER: { target: 'humanControlled' },
        SWITCH_MODE: [
          { guard: ({ event }) => event.mode === 'agent-controlled', target: 'agentControlled' },
          { guard: ({ event }) => event.mode === 'human-controlled', target: 'humanControlled' },
        ],
        SESSION_ENDED: { target: 'ended' },
      },
    },

    // ── Ended (terminal state) ────────────────────────────────────────
    ended: {
      type: 'final',
    },
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

export type ControlMachineActor = ActorRefFrom<typeof controlMachine>
export type ControlMachineSnapshot = SnapshotFrom<typeof controlMachine>

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the top-level mode from a machine snapshot */
export function snapshotToMode(snapshot: ControlMachineSnapshot): ControlMode {
  if (snapshot.matches('agentControlled')) return 'agent-controlled'
  if (snapshot.matches('humanControlled')) return 'human-controlled'
  if (snapshot.matches('supervised')) return 'supervised'
  // ended — return last known mode from context
  return snapshot.context.mode
}

/** Extract current controller from snapshot */
export function snapshotToController(snapshot: ControlMachineSnapshot): ControllerRole {
  return snapshot.context.controller
}

/** Check if agent is allowed to write in current state */
export function canAgentWrite(snapshot: ControlMachineSnapshot): boolean {
  if (snapshot.matches('agentControlled')) return true
  if (snapshot.matches('humanControlled')) return false
  if (snapshot.matches({ supervised: 'agentRunning' })) return true
  if (snapshot.matches({ supervised: 'humanOverride' })) return false
  return false // ended
}

/** Check if human input is allowed in current state */
export function canHumanWrite(snapshot: ControlMachineSnapshot): boolean {
  if (snapshot.matches('humanControlled')) return true
  if (snapshot.matches('supervised')) return true // always allowed, triggers override
  if (snapshot.matches('agentControlled')) return true // triggers takeover
  return false // ended
}
