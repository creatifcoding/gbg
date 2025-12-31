/**
 * Terminal v2 Atoms
 *
 * Effect-atom integration for terminal state management.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer } from 'effect'
import { TauriPtyService } from '../services/TauriPtyService'
import type { TerminalMode, TerminalStatus, TerminalInstanceState, TerminalConfig } from '../schemas'

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Terminal runtime combining all service layers.
 * Extend this when adding more services (e.g., WebSocket fallback).
 */
export const terminalRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    TauriPtyService.Live
  )
)

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Current terminal mode: ghostty (pure xterm) or openwarp (AI blocks)
 */
export const terminalModeAtom = Atom.make<TerminalMode>('ghostty')

/**
 * Global terminal status
 */
export const terminalStatusAtom = Atom.make<TerminalStatus>('disconnected')

/**
 * Active terminal ID (for multi-terminal support)
 */
export const activeTerminalIdAtom = Atom.make<string | null>(null)

/**
 * Terminal instance states (keyed by ID)
 */
export const terminalInstancesAtom = Atom.make<Map<string, TerminalInstanceState>>(new Map())

/**
 * Current terminal configuration
 */
export const terminalConfigAtom = Atom.make<Partial<TerminalConfig>>({
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontWeight: 'normal',
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
})

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Active terminal instance state
 */
export const activeTerminalAtom = Atom.make((get) => {
  const id = get(activeTerminalIdAtom)
  if (!id) return null
  const instances = get(terminalInstancesAtom)
  return instances.get(id) ?? null
})

/**
 * Whether terminal is connected and ready
 */
export const isTerminalReadyAtom = Atom.make((get) => {
  const status = get(terminalStatusAtom)
  return status === 'connected'
})

/**
 * Current working directory of active terminal
 */
export const activePwdAtom = Atom.make((get) => {
  const active = get(activeTerminalAtom)
  return active?.pwd
})

/**
 * Number of active terminals
 */
export const terminalCountAtom = Atom.make((get) => {
  const instances = get(terminalInstancesAtom)
  return instances.size
})

// =============================================================================
// Operation Atoms
// =============================================================================

/**
 * Set terminal mode
 */
export const setTerminalMode = (mode: TerminalMode) => {
  Atom.set(terminalModeAtom, mode)
}

/**
 * Toggle terminal mode between ghostty and openwarp
 */
export const toggleTerminalMode = () => {
  const current = Atom.get(terminalModeAtom)
  Atom.set(terminalModeAtom, current === 'ghostty' ? 'openwarp' : 'ghostty')
}

/**
 * Update terminal config
 */
export const updateTerminalConfig = (config: Partial<TerminalConfig>) => {
  Atom.set(terminalConfigAtom, (prev) => ({ ...prev, ...config }))
}

/**
 * Register a terminal instance
 */
export const registerTerminal = (id: string, state: Partial<TerminalInstanceState>) => {
  const fullState: TerminalInstanceState = {
    id,
    status: 'disconnected',
    mode: 'ghostty',
    lastActivity: Date.now(),
    isReady: false,
    ...state,
  }

  Atom.set(terminalInstancesAtom, (prev) => {
    const next = new Map(prev)
    next.set(id, fullState)
    return next
  })
}

/**
 * Update terminal instance state
 */
export const updateTerminalInstance = (id: string, update: Partial<TerminalInstanceState>) => {
  Atom.set(terminalInstancesAtom, (prev) => {
    const existing = prev.get(id)
    if (!existing) return prev

    const next = new Map(prev)
    next.set(id, {
      ...existing,
      ...update,
      lastActivity: Date.now(),
    })
    return next
  })
}

/**
 * Unregister a terminal instance
 */
export const unregisterTerminal = (id: string) => {
  Atom.set(terminalInstancesAtom, (prev) => {
    const next = new Map(prev)
    next.delete(id)
    return next
  })

  // Clear active if it was this terminal
  if (Atom.get(activeTerminalIdAtom) === id) {
    Atom.set(activeTerminalIdAtom, null)
  }
}

/**
 * Set active terminal
 */
export const setActiveTerminal = (id: string | null) => {
  Atom.set(activeTerminalIdAtom, id)
}

// =============================================================================
// Effect Operations (via runtime)
// =============================================================================

/**
 * Spawn a new PTY via TauriPtyService
 */
export const spawnTerminalOp = terminalRuntimeAtom.fn<{
  rows: number
  cols: number
  shell?: string
  cwd?: string
}>()((args, ctx) =>
  Effect.gen(function* () {
    ctx.set(terminalStatusAtom, 'connecting')

    try {
      const ptyService = yield* TauriPtyService
      const handle = yield* ptyService.spawn({
        rows: args.rows,
        cols: args.cols,
        shell: args.shell,
        cwd: args.cwd,
      })

      // Register instance
      registerTerminal(handle.id, {
        status: 'connected',
        isReady: true,
      })

      ctx.set(terminalStatusAtom, 'connected')
      ctx.set(activeTerminalIdAtom, handle.id)

      return handle
    } catch (e) {
      ctx.set(terminalStatusAtom, 'error')
      throw e
    }
  })
)

/**
 * Kill a terminal PTY
 */
export const killTerminalOp = terminalRuntimeAtom.fn<{ id: string }>()((args, ctx) =>
  Effect.gen(function* () {
    const ptyService = yield* TauriPtyService
    yield* ptyService.kill(args.id)

    unregisterTerminal(args.id)

    // Update status if no more terminals
    const instances = Atom.get(terminalInstancesAtom)
    if (instances.size === 0) {
      ctx.set(terminalStatusAtom, 'disconnected')
    }
  })
)

/**
 * List all PTY instances
 */
export const listTerminalsOp = terminalRuntimeAtom.fn<void>()((_, _ctx) =>
  Effect.gen(function* () {
    const ptyService = yield* TauriPtyService
    return yield* ptyService.list()
  })
)
