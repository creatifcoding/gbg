/**
 * Harness adapter atoms — per-instance state via Atom.family.
 *
 * Depends on: types.ts (type-only)
 * Also houses: module-scoped caches (instanceConfigCache, sessionIdCache),
 * setInstanceConfig, getInstanceConfig, setSessionId, getSessionId.
 *
 * @module morphchat/hooks/harness-adapter/atoms
 */

import { Atom } from '@effect-atom/atom-react'
import { Fiber, Layer } from 'effect'
import {
  HarnessBrowserTransportWebSocketDefault,
  HarnessRuntimeBrowserLive,
} from '@/lib/harness'
import type { HarnessSessionId, HarnessThinkingLevel } from '@/lib/harness/schemas'
import type { ChatMessage, ConnectionState, StreamingState, AgentInfo } from '../../schemas/message-types'
import { DISCONNECTED, STREAMING_IDLE } from '../../schemas/message-types'
import type { StreamPhase } from '../../schemas/message-types'
import { morphChatRegistry } from '../../atoms/registry'
import type { MetricEntry, ProviderMarker } from '../../schemas/metric-types'
import type {
  HarnessModelOption,
  HarnessStatusRow,
  ContextUsage,
  HarnessInstanceConfig,
} from './types'

// ─── Module-Scoped Caches ─────────────────────────────────────────────────────

export const instanceConfigCache = new Map<string, HarnessInstanceConfig>()
export const sessionIdCache = new Map<string, HarnessSessionId>()

// ─── Shared Runtime — one WS transport for ALL instances ──────────────────────

const HarnessRuntimeBrowserSharedLayer = HarnessRuntimeBrowserLive.pipe(
  Layer.provideMerge(HarnessBrowserTransportWebSocketDefault),
)

export const harnessRuntimeAtom = Atom.runtime(HarnessRuntimeBrowserSharedLayer)

// ─── Per-Instance State Atoms ─────────────────────────────────────────────────

export const messages$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<ChatMessage>>([]),
)

export const messageIds$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<string>>([]),
)

// Nested family: getMessageAtom(instanceId, messageId) → per-message atom
const messageAtomMaps = new Map<string, Map<string, Atom.WritableAtom<ChatMessage | null>>>()

export function getMessageAtom(instanceId: string, messageId: string): Atom.WritableAtom<ChatMessage | null> {
  let map = messageAtomMaps.get(instanceId)
  if (!map) {
    map = new Map()
    messageAtomMaps.set(instanceId, map)
  }

  let atom = map.get(messageId)
  if (!atom) {
    atom = Atom.make<ChatMessage | null>(null)
    map.set(messageId, atom)
  }

  return atom
}

export { messageAtomMaps }

export function clearMessageAtoms(instanceId: string): void {
  messageAtomMaps.delete(instanceId)
}

export const connection$ = Atom.family((_id: string) =>
  Atom.make<ConnectionState>(DISCONNECTED),
)
export const streaming$ = Atom.family((_id: string) =>
  Atom.make<StreamingState>(STREAMING_IDLE),
)
export const agents$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<AgentInfo>>([]),
)
export const sessionId$ = Atom.family((_id: string) =>
  Atom.make<HarnessSessionId | null>(null),
)
export const eventFiber$ = Atom.family((_id: string) =>
  Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null),
)
export const shellEventFiber$ = Atom.family((_id: string) =>
  Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null),
)
export const metrics$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<MetricEntry>>([]),
)
export const provider$ = Atom.family((_id: string) =>
  Atom.make<ProviderMarker | null>(null),
)
export const contextUsage$ = Atom.family((_id: string) =>
  Atom.make<ContextUsage | null>(null),
)
export const statusRows$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<HarnessStatusRow>>([]),
)
export const availableModels$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<HarnessModelOption>>([]),
)
export const selectedModel$ = Atom.family((_id: string) =>
  Atom.make<string | null>(null),
)
export const modelOverride$ = Atom.family((_id: string) =>
  Atom.make<{ provider: string; modelId: string } | null>(null),
)
export const lastError$ = Atom.family((_id: string) =>
  Atom.make<{ code: string; message: string; at: number; details?: unknown } | null>(null),
)
export const cancelledAt$ = Atom.family((_id: string) =>
  Atom.make<number | null>(null),
)
export const modelsLoading$ = Atom.family((_id: string) =>
  Atom.make<boolean>(false),
)
export const modelsError$ = Atom.family((_id: string) =>
  Atom.make<string | null>(null),
)
export const instanceConfig$ = Atom.family((_id: string) =>
  Atom.make<HarnessInstanceConfig | null>(null),
)

// ─── Config + Session ID Management ──────────────────────────────────────────

export const setInstanceConfig = (id: string, cfg: HarnessInstanceConfig) => {
  instanceConfigCache.set(id, cfg)
  morphChatRegistry.set(instanceConfig$(id), cfg)
}

export const getInstanceConfig = (id: string): HarnessInstanceConfig | null =>
  morphChatRegistry.get(instanceConfig$(id)) ?? instanceConfigCache.get(id) ?? null

export const setSessionId = (id: string, value: HarnessSessionId | null, reason: string) => {
  if (value == null) {
    sessionIdCache.delete(id)
  } else {
    sessionIdCache.set(id, value)
  }
  morphChatRegistry.set(sessionId$(id), value)

  // ── Session-scoped streaming reconciliation guard ──────────────────
  const streaming = morphChatRegistry.get(streaming$(id))
  const activePhases = new Set(['waiting', 'receiving', 'finalizing'] as const)
  if ((activePhases as Set<string>).has(streaming.phase) && streaming.sessionId !== (value ?? undefined)) {
    morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
  }

  const sidText = value ?? 'none'
  morphChatRegistry.update(statusRows$(id), (prev) => [
    {
      id: `status-${Date.now()}-sid`,
      tone: 'info' as const,
      text: `[sid] ${sidText} (${reason})`,
      source: 'harness' as const,
      details: {
        reason,
        sessionId: value,
      },
    },
    ...prev,
  ].slice(0, 8))

  if (typeof console !== 'undefined') {
    console.info('[harness:sid]', {
      instanceId: id,
      sessionId: value,
      reason,
    })
  }
}

export const getSessionId = (id: string): HarnessSessionId | null =>
  morphChatRegistry.get(sessionId$(id)) ?? sessionIdCache.get(id) ?? null
