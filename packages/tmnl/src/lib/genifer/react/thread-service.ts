/**
 * ThreadService — Conversation state management for genifer
 *
 * Registry-based Atom-as-State (same pattern as StateSyncService, ToolRegistryService).
 *
 * @module genifer/react/thread-service
 */

import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { nanoid } from 'nanoid'
import { Thread, ThreadMessage, type MessageContent, type MessageRole } from '../core/threads.js'

// =============================================================================
// Atoms
// =============================================================================

/** Active thread (currently displayed) */
export const activeThreadAtom = Atom.make<Thread | null>(null).pipe(Atom.keepAlive)

/** Thread history (all threads, keyed by ID) */
export const threadHistoryAtom = Atom.make<ReadonlyMap<string, Thread>>(
  new Map(),
).pipe(Atom.keepAlive)

// =============================================================================
// Service Shape
// =============================================================================

export type ThreadServiceShape = {
  /** Create a new thread and make it active */
  createThread: (title?: string) => Thread
  /** Add a message to the active thread */
  addMessage: (role: MessageRole, content: MessageContent[], model?: string) => ThreadMessage
  /** Get the active thread */
  getActiveThread: () => Thread | null
  /** Switch to a different thread */
  setActiveThread: (threadId: string) => void
  /** Get a thread by ID */
  getThread: (threadId: string) => Thread | undefined
  /** Fork the active thread at a message index */
  forkThread: (atIndex: number, title?: string) => Thread
  /** List all thread IDs */
  listThreads: () => readonly Thread[]
  /** Reset everything */
  reset: () => void
  /** The registry */
  readonly registry: Registry.Registry
}

// =============================================================================
// Factory
// =============================================================================

export function createThreadService(
  registry: Registry.Registry = Registry.make(),
): ThreadServiceShape {
  function now() {
    return new Date().toISOString()
  }

  function updateHistory(thread: Thread) {
    const history = new Map(registry.get(threadHistoryAtom))
    history.set(thread.id, thread)
    registry.set(threadHistoryAtom, history)
  }

  return {
    createThread(title) {
      const thread = new Thread({
        id: nanoid(),
        messages: [],
        title,
        createdAt: now(),
        updatedAt: now(),
      })
      registry.set(activeThreadAtom, thread)
      updateHistory(thread)
      return thread
    },

    addMessage(role, content, model) {
      const active = registry.get(activeThreadAtom)
      if (!active) throw new Error('No active thread')

      const message = new ThreadMessage({
        id: nanoid(),
        role,
        content,
        timestamp: now(),
        model,
      })

      const updated = new Thread({
        ...active,
        messages: [...active.messages, message],
        updatedAt: now(),
      })

      registry.set(activeThreadAtom, updated)
      updateHistory(updated)
      return message
    },

    getActiveThread() {
      return registry.get(activeThreadAtom)
    },

    setActiveThread(threadId) {
      const thread = registry.get(threadHistoryAtom).get(threadId)
      if (thread) {
        registry.set(activeThreadAtom, thread)
      }
    },

    getThread(threadId) {
      return registry.get(threadHistoryAtom).get(threadId)
    },

    forkThread(atIndex, title) {
      const active = registry.get(activeThreadAtom)
      if (!active) throw new Error('No active thread')

      const forkedMessages = active.messages.slice(0, atIndex + 1)
      const fork = new Thread({
        id: nanoid(),
        messages: forkedMessages,
        title: title ?? `Fork of ${active.title ?? active.id}`,
        createdAt: now(),
        updatedAt: now(),
        parentThreadId: active.id,
        forkAtIndex: atIndex,
      })

      registry.set(activeThreadAtom, fork)
      updateHistory(fork)
      return fork
    },

    listThreads() {
      return Array.from(registry.get(threadHistoryAtom).values())
    },

    reset() {
      registry.set(activeThreadAtom, null)
      registry.set(threadHistoryAtom, new Map())
    },

    get registry() {
      return registry
    },
  }
}

// =============================================================================
// Singleton
// =============================================================================

let _instance: ThreadServiceShape | null = null

export function getThreadService(): ThreadServiceShape {
  if (!_instance) {
    _instance = createThreadService()
  }
  return _instance
}
