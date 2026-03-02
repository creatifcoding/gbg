/**
 * Session V2 Facade — Bridge Layer
 *
 * Shadows existing harness-adapter session operations into session v2.
 * Zero breaking changes — existing code continues to work unchanged.
 * V2 accumulates state in parallel, ready for migration.
 *
 * Integration points:
 *   1. wireSessionV2(instanceId) — call during harness adapter init
 *   2. appendToSessionV2(instanceId, message) — call on each message
 *   3. disposeSessionV2(instanceId) — call on adapter cleanup
 *
 * This is a write-through shadow:
 *   - Existing atoms (messages$, messageIds$) remain primary
 *   - Session v2 atoms (sessionTree$, etc.) accumulate in parallel
 *   - Session drawer can read from EITHER source
 *   - Full migration replaces old atoms with v2 atoms
 *
 * @module harness/session/v2/facade
 */

import {
  sessionRegistry,
  activeSessionId$,
  sessionTree$,
  createSession,
  appendMessage,
  disposeSession,
  flushSession,
} from './atoms'
import type { HarnessSessionId, EntryId } from './identity'
import type { SessionMessage } from './entries'

// =============================================================================
// Instance → Session mapping
// =============================================================================

/**
 * Maps morphchat instance IDs to session v2 IDs.
 * An instance can have exactly one active v2 session.
 */
const instanceToSession = new Map<string, HarnessSessionId>()

// =============================================================================
// Facade API
// =============================================================================

/**
 * Wire a morphchat instance to a session v2 session.
 *
 * Call during harness adapter initialization.
 * Creates a new v2 session (or resumes if ID provided).
 *
 * Returns the session v2 ID for the instance.
 */
export function wireSessionV2(
  instanceId: string,
  opts?: { cwd?: string; existingSessionId?: HarnessSessionId },
): HarnessSessionId {
  // If already wired, return existing
  const existing = instanceToSession.get(instanceId)
  if (existing) return existing

  const sid = createSession({
    cwd: opts?.cwd ?? process.cwd?.() ?? '.',
  })

  instanceToSession.set(instanceId, sid)
  return sid
}

/**
 * Shadow-write a message to the v2 session tree.
 *
 * Call alongside existing message atom writes.
 * If instance isn't wired, silently skips.
 */
export function appendToSessionV2(
  instanceId: string,
  message: SessionMessage,
): EntryId | null {
  const sid = instanceToSession.get(instanceId)
  if (!sid) return null
  return appendMessage(sid, message)
}

/**
 * Flush and dispose the v2 session for an instance.
 *
 * Call during harness adapter cleanup.
 */
export async function disposeSessionV2(
  instanceId: string,
): Promise<void> {
  const sid = instanceToSession.get(instanceId)
  if (!sid) return

  flushSession(sid)
  instanceToSession.delete(instanceId)
  // Don't dispose the session itself — it should persist for replay
}

/**
 * Get the v2 session ID for a morphchat instance.
 */
export function getSessionV2Id(
  instanceId: string,
): HarnessSessionId | null {
  return instanceToSession.get(instanceId) ?? null
}

/**
 * Check if a morphchat instance has a v2 session wired.
 */
export function hasSessionV2(instanceId: string): boolean {
  return instanceToSession.has(instanceId)
}

/**
 * Get the full instance→session mapping (for debugging/devtools).
 */
export function getSessionV2Map(): ReadonlyMap<string, HarnessSessionId> {
  return instanceToSession
}
