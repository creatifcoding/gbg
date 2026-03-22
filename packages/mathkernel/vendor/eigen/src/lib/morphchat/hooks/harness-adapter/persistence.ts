/**
 * Harness adapter persistence — debounced content write-through to localStorage.
 *
 * Depends on: atoms.ts (for registry reads)
 *
 * @module morphchat/hooks/harness-adapter/persistence
 */

import { Effect } from 'effect'
import { morphChatRegistry } from '../../atoms/registry'
import { writeContent, readContent, ContentStoreLive } from '../../persistence/content-store'
import { messages$, messageIds$, getSessionId, getMessageAtom } from './atoms'

// ─── Module State ─────────────────────────────────────────────────────────────

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()
const PERSIST_DEBOUNCE_MS = 500

// ─── Debounced Persist ────────────────────────────────────────────────────────

/** Schedule a debounced content write for a given instance */
export function schedulePersist(id: string): void {
  const existing = persistTimers.get(id)
  if (existing) clearTimeout(existing)

  persistTimers.set(id, setTimeout(() => {
    persistTimers.delete(id)
    const msgs = morphChatRegistry.get(messages$(id))
    const ids = morphChatRegistry.get(messageIds$(id))
    const sid = getSessionId(id)
    // Fire-and-forget with ContentStoreLive
    Effect.runPromise(
      writeContent(id, sid, msgs, ids).pipe(
        Effect.provide(ContentStoreLive),
      ),
    ).catch(() => { /* best-effort persistence */ })
  }, PERSIST_DEBOUNCE_MS))
}

// ─── Hydration ────────────────────────────────────────────────────────────────

/** Hydrate content from localStorage for a given instance.
 *  Returns true if content was restored, false otherwise. */
export async function hydrateContent(id: string): Promise<boolean> {
  try {
    const result = await Effect.runPromise(
      readContent(id).pipe(Effect.provide(ContentStoreLive)),
    )
    if (result._tag === 'None') return false
    const snapshot = result.value
    morphChatRegistry.set(messages$(id), snapshot.messages)
    morphChatRegistry.set(messageIds$(id), snapshot.messageIds)
    for (const msg of snapshot.messages) {
      morphChatRegistry.set(getMessageAtom(id, msg.id), msg)
    }
    return true
  } catch {
    return false
  }
}
