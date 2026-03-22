/**
 * Minibuffer Debug Probe
 *
 * Exposes runtime state to window.__MINIBUFFER_DEBUG__ for inspection via Playwright.
 * Import this file in development to enable debugging.
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"
import { Deferred } from "effect"
import * as atoms from "./atoms"
import { forceLockAtom } from "@/components/splash/services"
import { overlayRegistry } from "@/lib/overlays/atoms"

// ─────────────────────────────────────────────────────────────
// Debug Interface
// ─────────────────────────────────────────────────────────────

interface MinibufferDebug {
  // State getters
  getMode: () => string
  getInput: () => string
  getPrompt: () => string
  getCompletions: () => readonly atoms.Completion[]
  getSelectedIndex: () => number
  getSelectedCompletion: () => atoms.Completion | null
  isActive: () => boolean
  hasPendingDeferred: () => boolean
  getForceLock: () => boolean

  // Deferred inspection
  getDeferredState: () => {
    exists: boolean
    // Can't easily inspect Deferred internals, but we can try to poll it
  }

  // Manual triggers
  setForceLock: (value: boolean) => void
  resetMinibuffer: () => void

  // Direct Deferred manipulation (for testing)
  succeedDeferred: (value: string) => boolean

  // Event log
  log: string[]
  addLog: (msg: string) => void
  clearLog: () => void

  // Full state dump
  dumpState: () => Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────

const eventLog: string[] = []

const debug: MinibufferDebug = {
  // State getters
  getMode: () => Atom.get(atoms.minibufferModeAtom),
  getInput: () => Atom.get(atoms.minibufferInputAtom),
  getPrompt: () => Atom.get(atoms.minibufferPromptAtom),
  getCompletions: () => Atom.get(atoms.minibufferCompletionsAtom),
  getSelectedIndex: () => Atom.get(atoms.minibufferSelectedIndexAtom),
  getSelectedCompletion: () => Atom.get(atoms.selectedCompletionAtom),
  isActive: () => Atom.get(atoms.isMinibufferActiveAtom),
  hasPendingDeferred: () => Atom.get(atoms.pendingDeferredAtom) !== null,
  getForceLock: () => Atom.get(forceLockAtom),

  // Deferred inspection
  getDeferredState: () => {
    const deferred = Atom.get(atoms.pendingDeferredAtom)
    return {
      exists: deferred !== null,
    }
  },

  // Manual triggers
  setForceLock: (value: boolean) => {
    // Use overlayRegistry.set() - this actually mutates
    // Atom.set() returns an Effect that never runs
    overlayRegistry.set(forceLockAtom, value)
    debug.addLog(`setForceLock(${value}) via overlayRegistry`)
  },

  resetMinibuffer: () => {
    atoms.resetMinibuffer()
    debug.addLog('resetMinibuffer()')
  },

  // Direct Deferred manipulation
  succeedDeferred: (value: string) => {
    const deferred = Atom.get(atoms.pendingDeferredAtom)
    if (!deferred) {
      debug.addLog(`succeedDeferred("${value}") - NO DEFERRED`)
      return false
    }

    debug.addLog(`succeedDeferred("${value}") - attempting...`)

    try {
      // Try synchronous succeed
      const unsafeSucceed = (Deferred as any).unsafeDone
      if (unsafeSucceed) {
        // Effect internals - might not exist
        debug.addLog(`succeedDeferred - using unsafeDone`)
      }

      // Standard approach - this creates an Effect, we need to run it
      // For debugging, let's try to access internal state
      debug.addLog(`succeedDeferred - deferred object keys: ${Object.keys(deferred).join(', ')}`)

      // Check if it's already done
      const state = (deferred as any).state
      debug.addLog(`succeedDeferred - deferred.state: ${JSON.stringify(state)}`)

      return true
    } catch (e) {
      debug.addLog(`succeedDeferred - error: ${e}`)
      return false
    }
  },

  // Event log
  log: eventLog,
  addLog: (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    eventLog.push(`[${timestamp}] ${msg}`)
    if (eventLog.length > 100) eventLog.shift()
    console.log(`[MINIBUFFER_DEBUG] ${msg}`)
  },
  clearLog: () => {
    eventLog.length = 0
  },

  // Full state dump
  dumpState: () => ({
    mode: debug.getMode(),
    input: debug.getInput(),
    prompt: debug.getPrompt(),
    completionsCount: debug.getCompletions().length,
    selectedIndex: debug.getSelectedIndex(),
    selectedCompletion: debug.getSelectedCompletion(),
    isActive: debug.isActive(),
    hasPendingDeferred: debug.hasPendingDeferred(),
    forceLock: debug.getForceLock(),
    logLength: eventLog.length,
  }),
}

// ─────────────────────────────────────────────────────────────
// Global Registration
// ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __MINIBUFFER_DEBUG__: MinibufferDebug
  }
}

// Also expose Atom for direct testing
declare global {
  interface Window {
    __ATOM__: typeof Atom
    __ATOMS__: typeof atoms
    __FORCE_LOCK_ATOM__: typeof forceLockAtom
  }
}

if (typeof window !== 'undefined') {
  window.__MINIBUFFER_DEBUG__ = debug
  window.__ATOM__ = Atom
  window.__ATOMS__ = atoms
  window.__FORCE_LOCK_ATOM__ = forceLockAtom
  console.log('[MINIBUFFER_DEBUG] Debug probe installed. Access via window.__MINIBUFFER_DEBUG__')
  console.log('[MINIBUFFER_DEBUG] Atom API via window.__ATOM__')
  console.log('[MINIBUFFER_DEBUG] Atoms via window.__ATOMS__')
}

export { debug as minibufferDebug }
