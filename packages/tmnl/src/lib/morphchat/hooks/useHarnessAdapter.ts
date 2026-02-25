/**
 * useHarnessAdapter — Per-instance harness sessions via Atom.family scoping.
 *
 * Each instanceId gets fully isolated state (messages, connection, session)
 * while sharing one WebSocket transport (RuntimeAtom singleton).
 * Like Cursor agent tabs — each panel is an independent concurrent session.
 *
 * Pattern:
 *   const msgs = messages$('panel-1')   // Atom.family → per-instance atom
 *   const conn = connection$('panel-1') // independent from messages$('panel-2')
 *   const op   = connectOp$('panel-1')  // fn-atom closes over 'panel-1' atoms
 *
 * @module morphchat/hooks/useHarnessAdapter
 */

import React, { useEffect, useRef } from 'react'
import { Atom, useAtom } from '@effect-atom/atom-react'
import { Cause, Effect, Option, Stream, Fiber } from 'effect'
import {
  toolStreamSink as toolStreamSinkEffect,
  toolStreamFinalize as toolStreamFinalizeEffect,
} from '@/lib/chat/msg/tool-block/renderers/terminal/tool-stream-sink'
import {
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
  HarnessRuntimeError,
} from '@/lib/harness'
import { HarnessBrowserTransport } from '@/lib/harness/HarnessBrowserTransport'
import {
  dispatchShellEvent,
  registerShellCommandSender,
  clearShellCommandSender,
  setShellRegistry,
} from '@/lib/harness/interactive-shell/shell-session-atoms'
import type { ShellEvent } from '@/lib/harness/interactive-shell/schemas'
import type { PanelEvent } from '@/lib/genifer/harness/panel-events'
import { registerGeniferPanelVisitor, setGeniferPanelRegistry, setGeniferPanelSurface } from '@/lib/genifer/harness/panel-visitor'
import { spawnPanel, closePanel, getPanel } from '@/lib/floating'
import { applyRemotePanelEvent } from './panel-event-handler'
import type {
  HarnessRole,
  HarnessSessionId,
  HarnessClientMessageId,
  HarnessThinkingLevel,
} from '@/lib/harness/schemas'

export const HARNESS_ROLES = ['scada-analyst', 'code-assistant', 'navigator', 'inspector', 'general'] as const

// Remote panel lifecycle maps (module-scoped so reconnect/replay can remain idempotent)
const remoteToLocalPanelIds = new Map<string, string>()
const remotePanelSurfaceIds = new Map<string, string>()
const surfaceToLocalPanelIds = new Map<string, string>()

import type { MorphChatAdapter } from '../schemas/adapter-types'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
  SendParams,
} from '../schemas/message-types'
import { DISCONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'
import { createEventProcessor } from '../adapters/harness-event-processor'
import { createExtensionToolBridge } from '@/lib/chat/msg/tool-block/renderers/extension-tool-bridge'
import type { MetricEntry, ProviderMarker } from '../schemas/metric-types'

setShellRegistry(morphChatRegistry)
setGeniferPanelRegistry(morphChatRegistry)

const morphchatLogDebug = Effect.fn('tmnl.morphchat.harness.log.debug')(function* (
  instanceId: string,
  message: string,
  payload?: Record<string, unknown>,
) {
  yield* Effect.logDebug(message).pipe(
    payload === undefined
      ? Effect.annotateLogs({ area: 'morphchat-harness-adapter', instanceId })
      : Effect.annotateLogs({ ...payload, area: 'morphchat-harness-adapter', instanceId }),
  )
})

const isInterruptedCause = (cause: unknown): boolean =>
  Cause.isCause(cause) && Cause.isInterruptedOnly(cause)

const morphchatCauseToMessage = Effect.fn('tmnl.morphchat.harness.cause-to-message')(function* (cause: unknown) {
  if (Cause.isCause(cause)) {
    return Cause.pretty(cause)
  }

  if (cause instanceof Error) {
    return cause.message
  }

  if (typeof cause === 'string') {
    return cause
  }

  return yield* Effect.sync(() => {
    if (cause == null) {
      return 'unknown'
    }

    try {
      return JSON.stringify(cause)
    } catch {
      return String(cause)
    }
  })
})

const morphchatLogWarningCause = Effect.fn('tmnl.morphchat.harness.log.warning-cause')(function* (
  instanceId: string,
  message: string,
  cause: unknown,
  payload?: Record<string, unknown>,
) {
  if (isInterruptedCause(cause)) {
    yield* morphchatLogDebug(instanceId, `${message}:interrupted`, payload)
    return
  }

  const causeMessage = yield* morphchatCauseToMessage(cause)
  yield* Effect.logWarning(message).pipe(
    payload === undefined
      ? Effect.annotateLogs({ area: 'morphchat-harness-adapter', instanceId, cause: causeMessage })
      : Effect.annotateLogs({ ...payload, area: 'morphchat-harness-adapter', instanceId, cause: causeMessage }),
  )
})

const runHarnessLog = (effect: Effect.Effect<unknown, unknown, never>) => {
  Effect.runFork(effect.pipe(Effect.catchAllCause(() => Effect.void)))
}

// =============================================================================
// Types
// =============================================================================

export interface HarnessModelOption {
  readonly id: string
  readonly modelId: string
  readonly label: string
  readonly provider: string
  readonly description?: string
  readonly color?: string
}

export interface HarnessStatusRow {
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
  readonly code?: string
  readonly details?: unknown
  readonly source?: 'harness' | 'surface' | 'mock'
}

interface HarnessInstanceConfig {
  readonly nodeId: string
  readonly role: HarnessRole
  readonly agentName: string
}

// =============================================================================
// Shared Runtime — one WS transport for ALL instances
// =============================================================================

export const harnessRuntimeAtom = Atom.runtime(HarnessRuntimeBrowserWebSocketDefault)

// =============================================================================
// Per-Instance State Atoms — Atom.family keyed by instanceId
// =============================================================================

export const messages$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<ChatMessage>>([]),
)
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
const eventFiber$ = Atom.family((_id: string) =>
  Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null),
)
const shellEventFiber$ = Atom.family((_id: string) =>
  Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null),
)
export const metrics$ = Atom.family((_id: string) =>
  Atom.make<ReadonlyArray<MetricEntry>>([]),
)
export const provider$ = Atom.family((_id: string) =>
  Atom.make<ProviderMarker | null>(null),
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
const modelOverride$ = Atom.family((_id: string) =>
  Atom.make<{ provider: string; modelId: string } | null>(null),
)
const instanceConfig$ = Atom.family((_id: string) =>
  Atom.make<HarnessInstanceConfig | null>(null),
)

// =============================================================================
// Per-Instance Infrastructure (tool bridges, event processors)
// =============================================================================

const toolBridges = new Map<string, ReturnType<typeof createExtensionToolBridge>>()
const processors = new Map<string, ReturnType<typeof createEventProcessor>>()

function getToolBridge(id: string) {
  let bridge = toolBridges.get(id)
  if (!bridge) {
    bridge = createExtensionToolBridge()
    toolBridges.set(id, bridge)
  }
  return bridge
}

function getProcessor(id: string, agentName: string) {
  let proc = processors.get(id)
  if (!proc) {
    const bridge = getToolBridge(id)
    proc = createEventProcessor({
      atoms: {
        messages$: messages$(id),
        connection$: connection$(id),
        streaming$: streaming$(id),
        agents$: agents$(id),
        sessionId$: sessionId$(id),
        metrics$: metrics$(id),
        provider$: provider$(id),
        statusRows$: statusRows$(id),
      },
      agentName,
      onToolManifest: (tools) => {
        const count = bridge.syncManifest({ tools })
        if (count > 0) {
          runHarnessLog(
            morphchatLogDebug(id, 'registered-extension-tool-renderers', {
              count,
            }),
          )
        }
      },
    })
    processors.set(id, proc)
  }
  return proc
}

// =============================================================================
// Helpers (shared, stateless)
// =============================================================================

function pushStatusRow(id: string, row: HarnessStatusRow): void {
  morphChatRegistry.update(statusRows$(id), (prev) => [row, ...prev].slice(0, 8))
}

function formatUnknownErrorPayload(payload: unknown): { code?: string; message: string; details: unknown } {
  const stringify = (v: unknown) => { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }
  const unwrap = (v: unknown): unknown => {
    if (!v || typeof v !== 'object') return v
    const r = v as Record<string, unknown>
    if (r._tag === 'Some') return r.value
    if (r._tag === 'None') return undefined
    return v
  }

  if (payload instanceof HarnessRuntimeError) {
    return { code: payload.code, message: payload.message, details: { _tag: 'HarnessRuntimeError', code: payload.code, message: payload.message, cause: unwrap((payload as any).cause) } }
  }
  if (payload instanceof Error) return { code: payload.name, message: payload.message, details: payload.stack ?? `${payload.name}: ${payload.message}` }
  if (typeof payload === 'string') {
    try { const p = JSON.parse(payload); if (typeof p?.message === 'string') return { code: p.code, message: p.message, details: stringify(p) } } catch {}
    return { message: payload, details: payload }
  }
  if (payload && typeof payload === 'object') {
    const r = payload as Record<string, unknown>
    return { code: typeof r.code === 'string' ? r.code : undefined, message: typeof r.message === 'string' ? r.message : stringify(r), details: r }
  }
  return { message: String(payload), details: String(payload) }
}

function runtimeErrorToStatus(id: string, op: string, err: HarnessRuntimeError): HarnessStatusRow {
  const parsed = formatUnknownErrorPayload(err)
  return { id: `status-${Date.now()}-${op}`, tone: 'error', text: `[${op}] ${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`, code: parsed.code, details: parsed.details, source: 'harness' }
}

function toHarnessThinkingLevel(level?: unknown): Option.Option<HarnessThinkingLevel> {
  if (typeof level === 'string') {
    switch (level) {
      case 'none': return Option.some('off' as HarnessThinkingLevel)
      case 'low': return Option.some('low' as HarnessThinkingLevel)
      case 'medium': return Option.some('medium' as HarnessThinkingLevel)
      case 'high': return Option.some('high' as HarnessThinkingLevel)
      default: return Option.none()
    }
  }
  if (typeof level === 'number') {
    if (level <= 0) return Option.some('off' as HarnessThinkingLevel)
    if (level <= 1) return Option.some('low' as HarnessThinkingLevel)
    if (level <= 2) return Option.some('medium' as HarnessThinkingLevel)
    return Option.some('high' as HarnessThinkingLevel)
  }
  return Option.none()
}

export interface ReplaySafePanelEventDeps {
  registerGeniferPanelVisitor: () => void
  setGeniferPanelSurface: (surfaceId: string, surface: unknown) => void
  spawnPanel: (visitorId: string, opts: {
    mode?: 'floating' | 'tiled'
    title?: string
    data?: unknown
    accent?: string
  }) => string | null
  closePanel: (panelId: string) => void
  remoteToLocalPanelIds: Map<string, string>
  panelExists?: (panelId: string) => boolean
  remotePanelSurfaceIds?: Map<string, string>
  surfaceToLocalPanelIds?: Map<string, string>
}

function dropPanelMapping(
  remotePanelId: string,
  remoteToLocal: Map<string, string>,
  remoteToSurface: Map<string, string>,
  surfaceToLocal: Map<string, string>,
): { localId?: string; surfaceId?: string } {
  const localId = remoteToLocal.get(remotePanelId)
  const surfaceId = remoteToSurface.get(remotePanelId)
  remoteToLocal.delete(remotePanelId)
  remoteToSurface.delete(remotePanelId)

  if (surfaceId && localId && surfaceToLocal.get(surfaceId) === localId) {
    surfaceToLocal.delete(surfaceId)
  }

  return { localId, surfaceId }
}

function prunePanelLifecycleMaps(
  remoteToLocal: Map<string, string>,
  remoteToSurface: Map<string, string>,
  surfaceToLocal: Map<string, string>,
  panelExists: (panelId: string) => boolean,
): void {
  for (const [remoteId, localId] of remoteToLocal.entries()) {
    if (panelExists(localId)) continue
    dropPanelMapping(remoteId, remoteToLocal, remoteToSurface, surfaceToLocal)
  }

  for (const [surfaceId, localId] of surfaceToLocal.entries()) {
    if (!panelExists(localId)) surfaceToLocal.delete(surfaceId)
  }
}

function dropAliasesForLocalPanel(
  localPanelId: string,
  keepRemoteId: string | null,
  remoteToLocal: Map<string, string>,
  remoteToSurface: Map<string, string>,
  surfaceToLocal: Map<string, string>,
): void {
  for (const [remoteId, candidateLocalId] of remoteToLocal.entries()) {
    if (candidateLocalId !== localPanelId) continue
    if (keepRemoteId != null && remoteId === keepRemoteId) continue
    dropPanelMapping(remoteId, remoteToLocal, remoteToSurface, surfaceToLocal)
  }
}

/**
 * Replay-safe wrapper around panel event handling.
 *
 * Guarantees:
 * - Duplicate/replayed panel:spawned events do not spawn duplicate local panels.
 * - Stale remote->local mappings are pruned when local panels disappear.
 * - panel:surface_updated remains idempotent and does not affect spawn lifecycle.
 */
export function applyReplaySafeRemotePanelEvent(
  event: PanelEvent & { surface?: unknown },
  deps: ReplaySafePanelEventDeps,
): void {
  const panelExists = deps.panelExists ?? (() => true)
  const remoteToLocal = deps.remoteToLocalPanelIds
  const remoteToSurface = deps.remotePanelSurfaceIds ?? new Map<string, string>()
  const surfaceToLocal = deps.surfaceToLocalPanelIds ?? new Map<string, string>()

  prunePanelLifecycleMaps(remoteToLocal, remoteToSurface, surfaceToLocal, panelExists)

  if (event._tag === 'panel:spawned') {
    if (!event.panelId || !event.surfaceId) return

    const existingLocalId = remoteToLocal.get(event.panelId)
    if (existingLocalId && panelExists(existingLocalId)) {
      remoteToSurface.set(event.panelId, event.surfaceId)
      surfaceToLocal.set(event.surfaceId, existingLocalId)
      if (event.surface) deps.setGeniferPanelSurface(event.surfaceId, event.surface)
      return
    }

    if (existingLocalId) {
      dropPanelMapping(event.panelId, remoteToLocal, remoteToSurface, surfaceToLocal)
    }

    const reusedLocalId = surfaceToLocal.get(event.surfaceId)
    if (reusedLocalId && panelExists(reusedLocalId)) {
      remoteToLocal.set(event.panelId, reusedLocalId)
      remoteToSurface.set(event.panelId, event.surfaceId)
      if (event.surface) deps.setGeniferPanelSurface(event.surfaceId, event.surface)
      return
    }

    if (reusedLocalId && !panelExists(reusedLocalId)) {
      surfaceToLocal.delete(event.surfaceId)
    }

    applyRemotePanelEvent(event, {
      registerGeniferPanelVisitor: deps.registerGeniferPanelVisitor,
      setGeniferPanelSurface: deps.setGeniferPanelSurface,
      spawnPanel: deps.spawnPanel,
      closePanel: deps.closePanel,
      remoteToLocalPanelIds: remoteToLocal,
    })

    const localPanelId = remoteToLocal.get(event.panelId)
    if (localPanelId) {
      remoteToSurface.set(event.panelId, event.surfaceId)
      surfaceToLocal.set(event.surfaceId, localPanelId)
    }
    return
  }

  if (event._tag === 'panel:closed') {
    if (!event.panelId) return

    const mappedLocalId = remoteToLocal.get(event.panelId)
    const directLocalId = panelExists(event.panelId) ? event.panelId : undefined
    const localPanelId = mappedLocalId ?? directLocalId

    if (!localPanelId) {
      dropPanelMapping(event.panelId, remoteToLocal, remoteToSurface, surfaceToLocal)
      return
    }

    deps.closePanel(localPanelId)
    dropPanelMapping(event.panelId, remoteToLocal, remoteToSurface, surfaceToLocal)
    dropAliasesForLocalPanel(localPanelId, null, remoteToLocal, remoteToSurface, surfaceToLocal)
    return
  }

  if (event._tag === 'panel:surface_updated') {
    if (!event.surfaceId || event.surface == null) return

    const localPanelId = surfaceToLocal.get(event.surfaceId)
    if (localPanelId && !panelExists(localPanelId)) {
      surfaceToLocal.delete(event.surfaceId)
    }

    applyRemotePanelEvent(event, {
      registerGeniferPanelVisitor: deps.registerGeniferPanelVisitor,
      setGeniferPanelSurface: deps.setGeniferPanelSurface,
      spawnPanel: deps.spawnPanel,
      closePanel: deps.closePanel,
      remoteToLocalPanelIds: remoteToLocal,
    })
  }
}

// =============================================================================
// Shared: Wire event stream + snapshot for a session
// =============================================================================

function wireEventStream(
  id: string,
  activeSessionId: HarnessSessionId,
  agentName: string,
  runtime: { events: Stream.Stream<any, any>; getSnapshot: (...args: any[]) => Effect.Effect<any, any> },
  transport: { events: Stream.Stream<unknown, any>; request: (cmd: unknown) => Effect.Effect<unknown, any> },
) {
  const processor = getProcessor(id, agentName)
  const seenSeqs = new Set<number>()

  const shouldProcess = (event: { sessionId?: unknown; seq?: unknown }) => {
    if (event.sessionId !== activeSessionId) return false
    const seq = typeof event.seq === 'number' ? event.seq : undefined
    if (seq == null) return true
    if (seenSeqs.has(seq)) return false
    seenSeqs.add(seq)
    return true
  }

  // Event stream fiber
  const eventFiberEffect = runtime.events.pipe(
    Stream.filter((event: any) => shouldProcess(event)),
    Stream.tap((event: any) => {
      if (event._tag === 'chat:v2/tool_event' && event.phase === 'stream' && event.payload?.chunk != null) {
        return toolStreamSinkEffect({ toolCallId: event.toolCallId, toolName: event.toolName, payload: event.payload })
      }
      if (event._tag === 'chat:v2/tool_event' && event.phase === 'end') {
        return toolStreamFinalizeEffect(event.toolCallId)
      }
      return Effect.void
    }),
    Stream.runForEach((event: any) => Effect.sync(() => processor.processEvent(event))),
    Stream.withSpan('tmnl.morphchat.harness.event-stream', {
      attributes: {
        instanceId: id,
        sessionId: activeSessionId,
      },
    }),
  ).pipe(
    Effect.catchAllCause((cause) =>
      Effect.gen(function* () {
        if (isInterruptedCause(cause)) {
          yield* morphchatLogDebug(id, 'event-stream-interrupted', {
            sessionId: activeSessionId,
          })
          return
        }

        yield* morphchatLogWarningCause(id, 'event-stream-failed', cause, {
          sessionId: activeSessionId,
        })

        // Only push errors if this session is still active — stale fibers must not corrupt new sessions
        const currentSid = morphChatRegistry.get(sessionId$(id))
        if (currentSid !== activeSessionId) return

        const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
        morphChatRegistry.set(connection$(id), { phase: 'error', error: `[events] ${parsed.message}` } as ConnectionState)
        pushStatusRow(id, { id: `status-${Date.now()}-events`, tone: 'error', text: `[events] ${parsed.message}`, source: 'harness' })
      }),
    ),
    Effect.forkDaemon,
  )

  // Shell event relay fiber
  const shellFiberEffect = transport.events.pipe(
    Stream.runForEach((rawEvent: any) =>
      Effect.sync(() => {
        if (rawEvent?._tag === 'remote:shell_event' && rawEvent.event) {
          dispatchShellEvent(rawEvent.event as ShellEvent)
          return
        }

        if (rawEvent?._tag === 'remote:panel_event' && rawEvent.event) {
          applyReplaySafeRemotePanelEvent(rawEvent.event as PanelEvent & { surface?: unknown }, {
            registerGeniferPanelVisitor,
            setGeniferPanelSurface: (surfaceId, surface) => setGeniferPanelSurface(surfaceId, surface as any),
            spawnPanel,
            closePanel,
            remoteToLocalPanelIds,
            remotePanelSurfaceIds,
            surfaceToLocalPanelIds,
            panelExists: (panelId) => getPanel(panelId) != null,
          })
        }
      }),
    ),
    Stream.withSpan('tmnl.morphchat.harness.transport-events', {
      attributes: {
        instanceId: id,
        sessionId: activeSessionId,
      },
    }),
  ).pipe(
    Effect.catchAllCause((cause) =>
      morphchatLogWarningCause(id, 'transport-events-stream-failed', cause, {
        sessionId: activeSessionId,
      }).pipe(Effect.asVoid),
    ),
    Effect.forkDaemon,
  )

  // Register shell command sender
  registerShellCommandSender((command) => {
    runHarnessLog(
      transport.request(command as any).pipe(
        Effect.withSpan('tmnl.morphchat.harness.shell-command-dispatch', {
          attributes: {
            instanceId: id,
            command: (command as { _tag?: unknown })._tag ?? 'unknown',
          },
        }),
        Effect.tapErrorCause((cause) =>
          morphchatLogWarningCause(id, 'shell-command-dispatch-failed', cause, {
            command: (command as { _tag?: unknown })._tag ?? 'unknown',
          }),
        ),
        Effect.asVoid,
      ),
    )
  })

  // Snapshot hydration
  const snapshotEffect = runtime.getSnapshot(activeSessionId, Option.none()).pipe(
    Effect.timeoutFail({
      duration: '3 seconds',
      onTimeout: () => new HarnessRuntimeError({ code: 'snapshot-timeout', message: 'Snapshot timeout', cause: Option.none() }),
    }),
    Effect.catchAllCause((cause) =>
      morphchatLogWarningCause(id, 'snapshot-hydration-failed', cause, {
        sessionId: activeSessionId,
      }).pipe(Effect.andThen(Effect.succeed(null))),
    ),
  )

  return { eventFiberEffect, shellFiberEffect, snapshotEffect, shouldProcess, processor }
}

function interruptInstanceFibers(id: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    const oldFiber = morphChatRegistry.get(eventFiber$(id))
    if (oldFiber) {
      yield* Fiber.interrupt(oldFiber)
      morphChatRegistry.set(eventFiber$(id), null)
    }

    const oldShellFiber = morphChatRegistry.get(shellEventFiber$(id))
    if (oldShellFiber) {
      yield* Fiber.interrupt(oldShellFiber)
      morphChatRegistry.set(shellEventFiber$(id), null)
    }
  })
}

function activateSessionWiring(
  id: string,
  activeSessionId: HarnessSessionId,
  nodeId: string,
  agentName: string,
  runtime: { events: Stream.Stream<any, any>; getSnapshot: (...args: any[]) => Effect.Effect<any, any> },
  snapshotOverride?: { events: ReadonlyArray<any> } | null,
  agentId?: string,
): Effect.Effect<void> {
  return Effect.gen(function* () {
    morphChatRegistry.set(sessionId$(id), activeSessionId)
    morphChatRegistry.set(connection$(id), { phase: 'connected', endpoint: `harness:${nodeId}` } as ConnectionState)
    morphChatRegistry.set(agents$(id), [{ id: agentId ?? nodeId, name: agentName, isActive: true }])

    const transport = yield* HarnessBrowserTransport
    const wired = wireEventStream(id, activeSessionId, agentName, runtime, transport)

    const fiber = yield* wired.eventFiberEffect
    morphChatRegistry.set(eventFiber$(id), fiber)

    const sFiber = yield* wired.shellFiberEffect
    morphChatRegistry.set(shellEventFiber$(id), sFiber)

    const snapshot = snapshotOverride === undefined
      ? yield* wired.snapshotEffect
      : snapshotOverride

    if (snapshot && morphChatRegistry.get(sessionId$(id)) === activeSessionId) {
      for (const event of snapshot.events) {
        if (wired.shouldProcess(event as any)) wired.processor.processEvent(event)
      }
    }
  })
}

// =============================================================================
// Per-Instance Fn-Atom Ops — Atom.family keyed by instanceId
// =============================================================================

/** Connect: open session + fork event stream */
const connectOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ nodeId: string; role: HarnessRole; agentName: string }>()(
    ({ nodeId, role, agentName }, _ctx) =>
      Effect.gen(function* () {
        const runtime = yield* HarnessRuntime

        yield* interruptInstanceFibers(id)

        morphChatRegistry.set(connection$(id), { phase: 'connecting', endpoint: `harness:${nodeId}` } as ConnectionState)

        const session = yield* runtime.openSession(nodeId, role).pipe(
          Effect.timeoutFail({
            duration: '12 seconds',
            onTimeout: () => new HarnessRuntimeError({ code: 'connect-timeout', message: `Timed out opening session for ${nodeId}`, cause: Option.none() }),
          }),
        )

        morphChatRegistry.set(statusRows$(id), [])
        yield* morphchatLogDebug(id, 'session-opened', {
          nodeId,
          sessionId: session.sessionId,
          agentId: session.agentId,
        })

        yield* activateSessionWiring(id, session.sessionId as HarnessSessionId, nodeId, agentName, runtime, undefined, session.agentId)

        return session.sessionId as string
      }).pipe(
        Effect.catchTag('HarnessRuntimeError', (error) =>
          Effect.sync(() => {
            morphChatRegistry.set(connection$(id), { phase: 'error', error: `[${error.code}] ${error.message}` } as ConnectionState)
            pushStatusRow(id, runtimeErrorToStatus(id, 'connect', error))
          }),
        ),
        Effect.catchAllCause((cause) =>
          Effect.gen(function* () {
            if (isInterruptedCause(cause)) {
              yield* morphchatLogDebug(id, 'connect-interrupted', { nodeId })
              return
            }

            yield* morphchatLogWarningCause(id, 'connect-failed', cause, {
              nodeId,
            })
            const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
            morphChatRegistry.set(connection$(id), { phase: 'error', error: parsed.message } as ConnectionState)
            pushStatusRow(id, { id: `status-${Date.now()}-connect`, tone: 'error', text: `[connect] ${parsed.message}`, source: 'harness' })
          }),
        ),
      ),
  ),
)

/** Fetch available models */
const fetchModelsOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime
      const models = yield* runtime.getAvailableModels()

      const idCounts = new Map<string, number>()
      for (const m of models) idCounts.set(m.id, (idCounts.get(m.id) ?? 0) + 1)

      const sorted = [...models].sort((a, b) => {
        const pa = a.provider === 'openai-codex' ? -1 : 0
        const pb = b.provider === 'openai-codex' ? -1 : 0
        if (pa !== pb) return pa - pb
        return a.name.localeCompare(b.name)
      })

      morphChatRegistry.set(availableModels$(id), sorted.map((m) => {
        const dup = (idCounts.get(m.id) ?? 0) > 1
        return {
          id: `${m.provider}:${m.id}`, modelId: m.id,
          label: dup ? `${m.name} (${m.provider})` : m.name,
          provider: m.provider, description: `${m.provider} · ${m.contextWindow.toLocaleString()} ctx`,
        }
      }))
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          if (isInterruptedCause(cause)) {
            yield* morphchatLogDebug(id, 'fetch-models-interrupted')
            return
          }

          yield* morphchatLogWarningCause(id, 'fetch-models-failed', cause)
          const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
          pushStatusRow(id, { id: `status-${Date.now()}-models`, tone: 'warn', text: `[models] ${parsed.message}`, source: 'harness' })
        }),
      ),
    ),
  ),
)

/** Send a message */
const sendOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ content: string; thinkingLevel?: unknown }>()(
    ({ content, thinkingLevel }, _ctx) =>
      Effect.gen(function* () {
        let sid = morphChatRegistry.get(sessionId$(id))
        const conn = morphChatRegistry.get(connection$(id)) as ConnectionState
        const runtime = yield* HarnessRuntime
        yield* morphchatLogDebug(id, 'send-start', {
          sessionId: sid ?? 'none',
          phase: conn?.phase ?? 'unknown',
        })

        if (!sid && (conn?.phase === 'connecting' || conn?.phase === 'reconnecting')) {
          pushStatusRow(id, {
            id: `status-${Date.now()}-send-autoheal-wait`,
            tone: 'info',
            text: '[send:auto-heal] waiting for in-flight session connect',
            source: 'harness',
          })

          for (let attempt = 0; attempt < 10; attempt++) {
            yield* Effect.sleep('50 millis')
            sid = morphChatRegistry.get(sessionId$(id))
            if (sid) break

            const phase = (morphChatRegistry.get(connection$(id)) as ConnectionState)?.phase
            if (phase !== 'connecting' && phase !== 'reconnecting') break
          }
        }

        if (!sid) {
          const cfg = morphChatRegistry.get(instanceConfig$(id))
          if (!cfg) {
            return yield* Effect.fail(new Error('No active session and no harness config available for auto-heal'))
          }

          pushStatusRow(id, {
            id: `status-${Date.now()}-send-autoheal-bootstrap`,
            tone: 'warn',
            text: '[send:auto-heal] bootstrapping a new session',
            source: 'harness',
          })

          morphChatRegistry.set(connection$(id), { phase: 'reconnecting', endpoint: `harness:${cfg.nodeId}` } as ConnectionState)

          const opened = yield* runtime.openSession(cfg.nodeId, cfg.role).pipe(
            Effect.timeoutFail({
              duration: '12 seconds',
              onTimeout: () => new HarnessRuntimeError({
                code: 'send-autoheal-timeout',
                message: `Timed out auto-healing session for ${cfg.nodeId}`,
                cause: Option.none(),
              }),
            }),
          )

          sid = opened.sessionId as HarnessSessionId
          yield* activateSessionWiring(id, sid, cfg.nodeId, cfg.agentName, runtime, undefined, opened.agentId)

          pushStatusRow(id, {
            id: `status-${Date.now()}-send-autoheal-recovered`,
            tone: 'info',
            text: `[send:auto-heal] session recovered (${sid})`,
            source: 'harness',
          })
        }

        const clientMessageId = `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as HarnessClientMessageId
        const userMsg: ChatMessage = {
          id: clientMessageId as string, role: 'operator', content,
          timestamp: new Date().toISOString(), status: 'pending',
        }
        morphChatRegistry.set(messages$(id), [...morphChatRegistry.get(messages$(id)), userMsg])

        const tl = toHarnessThinkingLevel(thinkingLevel)
        const override = morphChatRegistry.get(modelOverride$(id))
        if (override) morphChatRegistry.set(modelOverride$(id), null)

        yield* runtime.send(sid as HarnessSessionId, clientMessageId, content, tl, override ?? undefined)
      }).pipe(
        Effect.catchAllCause((cause) =>
          Effect.gen(function* () {
            if (isInterruptedCause(cause)) {
              morphChatRegistry.set(messages$(id), morphChatRegistry.get(messages$(id)).map((msg) =>
                msg.status === 'pending' ? { ...msg, status: 'error' as const } : msg,
              ))
              yield* morphchatLogDebug(id, 'send-interrupted')
              return
            }

            yield* morphchatLogWarningCause(id, 'send-failed', cause)
            morphChatRegistry.set(messages$(id), morphChatRegistry.get(messages$(id)).map((msg) =>
              msg.status === 'pending' ? { ...msg, status: 'error' as const } : msg,
            ))
            const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
            pushStatusRow(id, { id: `status-${Date.now()}-send`, tone: 'error', text: `[send] ${parsed.message}`, source: 'harness' })
          }),
        ),
      ),
  ),
)

/** Cancel/abort active session */
const cancelOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime
      const sid = morphChatRegistry.get(sessionId$(id))
      if (sid) yield* runtime.abortSession(sid)
      morphChatRegistry.update(messages$(id), (prev) =>
        prev.map((msg) => msg.status === 'streaming' ? { ...msg, status: 'complete' as const } : msg),
      )
      morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
    }).pipe(
      Effect.catchAllCause((cause) =>
        morphchatLogWarningCause(id, 'cancel-op-failed', cause).pipe(Effect.asVoid),
      ),
    ),
  ),
)

/** Clear messages */
const clearOp$ = Atom.family((_id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.sync(() => {
      morphChatRegistry.set(messages$(_id), [] as ReadonlyArray<ChatMessage>)
      morphChatRegistry.set(streaming$(_id), STREAMING_IDLE)
      morphChatRegistry.set(statusRows$(_id), [])
    }),
  ),
)

/** Dispose — interrupt fibers + abort session */
const disposeOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      yield* interruptInstanceFibers(id)
      const runtime = yield* HarnessRuntime
      const sid = morphChatRegistry.get(sessionId$(id))
      if (sid) {
        yield* runtime.abortSession(sid).pipe(
          Effect.catchAllCause((cause) =>
            morphchatLogWarningCause(id, 'dispose-abort-failed', cause, { sessionId: sid }).pipe(Effect.asVoid),
          ),
        )
      }
      getToolBridge(id).clear()
      clearShellCommandSender()
      morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
      morphChatRegistry.set(connection$(id), DISCONNECTED)
      morphChatRegistry.set(statusRows$(id), [])
      morphChatRegistry.set(instanceConfig$(id), null)

      // Cleanup infrastructure caches
      toolBridges.delete(id)
      processors.delete(id)
    }),
  ),
)

/** New session — keeps transport, opens fresh session */
const newSessionOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ nodeId: string; role: HarnessRole; agentName: string }>()(
    ({ nodeId, role, agentName }, _ctx) =>
      Effect.gen(function* () {
        const runtime = yield* HarnessRuntime

        yield* interruptInstanceFibers(id)

        // Abort old session
        const oldSid = morphChatRegistry.get(sessionId$(id))
        if (oldSid) {
          yield* runtime.abortSession(oldSid).pipe(
            Effect.catchAllCause((cause) =>
              morphchatLogWarningCause(id, 'new-session-abort-old-failed', cause, { sessionId: oldSid }).pipe(Effect.asVoid),
            ),
          )
        }

        // Clear state
        morphChatRegistry.set(messages$(id), [] as ReadonlyArray<ChatMessage>)
        morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
        morphChatRegistry.set(statusRows$(id), [])
        morphChatRegistry.set(sessionId$(id), null)
        getToolBridge(id).clear()
        processors.delete(id) // Force new processor

        // Open fresh session
        morphChatRegistry.set(connection$(id), { phase: 'connecting', endpoint: `harness:${nodeId}` } as ConnectionState)
        const session = yield* runtime.openSession(nodeId, role).pipe(
          Effect.timeoutFail({ duration: '12 seconds', onTimeout: () => new HarnessRuntimeError({ code: 'new-session-timeout', message: 'Timeout', cause: Option.none() }) }),
        )

        yield* activateSessionWiring(id, session.sessionId as HarnessSessionId, nodeId, agentName, runtime, undefined, session.agentId)
        return session.sessionId as string
      }).pipe(
        Effect.catchAllCause((cause) =>
          Effect.gen(function* () {
            if (isInterruptedCause(cause)) {
              yield* morphchatLogDebug(id, 'new-session-interrupted', { nodeId })
              return
            }

            yield* morphchatLogWarningCause(id, 'new-session-failed', cause, {
              nodeId,
            })
            const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
            morphChatRegistry.set(connection$(id), { phase: 'error', error: parsed.message } as ConnectionState)
            pushStatusRow(id, { id: `status-${Date.now()}-new-session`, tone: 'error', text: `[new-session] ${parsed.message}`, source: 'harness' })
          }),
        ),
      ),
  ),
)

/** Resume an existing session */
const resumeSessionOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ sessionId: string }>()(
    ({ sessionId }, _ctx) =>
      Effect.gen(function* () {
        const runtime = yield* HarnessRuntime
        const cfg = morphChatRegistry.get(instanceConfig$(id))
        if (!cfg) return yield* Effect.fail(new Error(`Missing harness config for instance: ${id}`))

        yield* interruptInstanceFibers(id)

        morphChatRegistry.set(messages$(id), [] as ReadonlyArray<ChatMessage>)
        morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
        morphChatRegistry.set(statusRows$(id), [])
        morphChatRegistry.set(sessionId$(id), null)
        getToolBridge(id).clear()
        processors.delete(id)

        morphChatRegistry.set(connection$(id), { phase: 'connecting', endpoint: `harness:${cfg.nodeId}` } as ConnectionState)

        const resumed = yield* runtime.resumeSession(sessionId as HarnessSessionId, Option.none()).pipe(
          Effect.timeoutFail({
            duration: '12 seconds',
            onTimeout: () => new HarnessRuntimeError({
              code: 'resume-session-timeout',
              message: `Timed out resuming session ${sessionId}`,
              cause: Option.none(),
            }),
          }),
        )

        yield* activateSessionWiring(
          id,
          resumed.sessionId as HarnessSessionId,
          cfg.nodeId,
          cfg.agentName,
          runtime,
          resumed,
        )

        pushStatusRow(id, {
          id: `status-${Date.now()}-resume-session`,
          tone: 'info',
          text: `[resume] Resumed session ${resumed.sessionId}`,
          source: 'harness',
        })

        return resumed.sessionId
      }).pipe(
        Effect.catchTag('HarnessRuntimeError', (error) =>
          Effect.sync(() => {
            morphChatRegistry.set(connection$(id), { phase: 'error', error: `[${error.code}] ${error.message}` } as ConnectionState)
            pushStatusRow(id, runtimeErrorToStatus(id, 'resume-session', error))
          }),
        ),
        Effect.catchAllCause((cause) =>
          Effect.gen(function* () {
            if (isInterruptedCause(cause)) {
              yield* morphchatLogDebug(id, 'resume-session-interrupted', {
                requestedSessionId: sessionId,
              })
              return
            }

            yield* morphchatLogWarningCause(id, 'resume-session-failed', cause, {
              requestedSessionId: sessionId,
            })
            const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
            morphChatRegistry.set(connection$(id), { phase: 'error', error: parsed.message } as ConnectionState)
            pushStatusRow(id, {
              id: `status-${Date.now()}-resume-session`,
              tone: 'error',
              text: `[resume-session] ${parsed.message}`,
              source: 'harness',
            })
          }),
        ),
      ),
  ),
)

// =============================================================================
// Hard Reconnect — refresh runtime atom (rebuild WS transport)
// =============================================================================

function hardReconnect(
  id: string,
  nodeId: string,
  role: HarnessRole,
  agentName: string,
  doConnect: (args: { nodeId: string; role: HarnessRole; agentName: string }) => void,
): void {
  // Kill existing fibers (best effort)
  const fiber = morphChatRegistry.get(eventFiber$(id))
  if (fiber) Effect.runFork(Fiber.interrupt(fiber))
  morphChatRegistry.set(eventFiber$(id), null)
  const sFiber = morphChatRegistry.get(shellEventFiber$(id))
  if (sFiber) Effect.runFork(Fiber.interrupt(sFiber))
  morphChatRegistry.set(shellEventFiber$(id), null)

  // Clear state
  morphChatRegistry.set(sessionId$(id), null)
  morphChatRegistry.set(messages$(id), [] as ReadonlyArray<ChatMessage>)
  morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
  morphChatRegistry.set(connection$(id), DISCONNECTED)
  morphChatRegistry.set(statusRows$(id), [])
  getToolBridge(id).clear()
  clearShellCommandSender()

  // Refresh runtime atom — rebuilds WS transport
  morphChatRegistry.refresh(harnessRuntimeAtom)

  // Reconnect after runtime rematerializes
  setTimeout(() => doConnect({ nodeId, role, agentName }), 100)
}

// =============================================================================
// Hook
// =============================================================================

export interface UseHarnessAdapterConfig {
  /** Unique instance ID — each ID gets fully isolated state (Cursor-style) */
  readonly instanceId: string
  readonly nodeId: string
  readonly role: HarnessRole
  readonly agentName?: string
  readonly autoConnect?: boolean
}

export type HarnessAdapterStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface UseHarnessAdapterResult {
  readonly adapter: MorphChatAdapter
  readonly status: HarnessAdapterStatus
  readonly error: string | null
  readonly connect: (args: { nodeId: string; role: HarnessRole; agentName: string }) => void
  readonly newSession: () => void
  readonly resumeSession: (sessionId: string) => void
  readonly hardReconnect: () => void
}

export function useHarnessAdapter(config: UseHarnessAdapterConfig): UseHarnessAdapterResult {
  const { instanceId, nodeId, role, agentName = 'Agent', autoConnect = true } = config

  // Bind per-instance fn-atom ops
  const [, doConnect] = useAtom(connectOp$(instanceId))
  const [, doSend] = useAtom(sendOp$(instanceId))
  const [, doCancel] = useAtom(cancelOp$(instanceId))
  const [, doClear] = useAtom(clearOp$(instanceId))
  const [, doDispose] = useAtom(disposeOp$(instanceId))
  const [, doFetchModels] = useAtom(fetchModelsOp$(instanceId))
  const [, doNewSession] = useAtom(newSessionOp$(instanceId))
  const [, doResumeSession] = useAtom(resumeSessionOp$(instanceId))

  // Connection status from per-instance atom
  const [status, setStatus] = React.useState<HarnessAdapterStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)

  useEffect(() => {
    const check = () => {
      const conn = morphChatRegistry.get(connection$(instanceId)) as any
      const phase = conn?.phase ?? 'idle'
      setStatus(
        phase === 'connected' ? 'connected' :
        phase === 'connecting' || phase === 'reconnecting' ? 'connecting' :
        phase === 'error' ? 'error' : 'idle',
      )
      setError(conn?.error ?? null)
    }
    check()
    return morphChatRegistry.subscribe(connection$(instanceId), check)
  }, [instanceId])

  useEffect(() => {
    morphChatRegistry.set(instanceConfig$(instanceId), { nodeId, role, agentName })
  }, [instanceId, nodeId, role, agentName])

  // Auto-connect with backoff
  const reconnectAttempts = useRef(0)
  useEffect(() => {
    if (!autoConnect) return
    if (status === 'connected' || status === 'connecting') return

    if (status === 'error') {
      const delay = Math.min(1500 * Math.pow(2, reconnectAttempts.current), 15000)
      reconnectAttempts.current++
      const timer = setTimeout(() => hardReconnect(instanceId, nodeId, role, agentName, doConnect), delay)
      return () => clearTimeout(timer)
    }

    reconnectAttempts.current = 0
    const timer = setTimeout(() => doConnect({ nodeId, role, agentName }), 0)
    return () => clearTimeout(timer)
  }, [autoConnect, status, nodeId, role, agentName, instanceId, doConnect])

  useEffect(() => { if (status === 'connected') reconnectAttempts.current = 0 }, [status])

  // Fetch models once connected
  const hasFetchedModels = useRef(false)
  useEffect(() => {
    if (status === 'connected' && !hasFetchedModels.current) {
      hasFetchedModels.current = true
      doFetchModels(undefined as void)
    }
  }, [status, doFetchModels])

  // Dispose on unmount
  useEffect(() => {
    return () => { doDispose(undefined as void) }
  }, [instanceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable refs for adapter
  const sendRef = useRef(doSend); sendRef.current = doSend
  const cancelRef = useRef(doCancel); cancelRef.current = doCancel
  const connectRef = useRef(doConnect); connectRef.current = doConnect
  const clearRef = useRef(doClear); clearRef.current = doClear
  const newSessionRef = useRef(doNewSession); newSessionRef.current = doNewSession
  const resumeSessionRef = useRef(doResumeSession); resumeSessionRef.current = doResumeSession

  // Build adapter — per-instance atoms
  const adapter = React.useMemo<MorphChatAdapter>(() => ({
    adapterId: `harness-${instanceId}`,
    label: `Harness (${instanceId})`,
    messages$: messages$(instanceId),
    connection$: connection$(instanceId),
    streaming$: streaming$(instanceId),
    agents$: agents$(instanceId),
    metrics$: metrics$(instanceId),
    provider$: provider$(instanceId),
    statusRows$: statusRows$(instanceId),
    availableModels$: availableModels$(instanceId),
    selectedModel$: selectedModel$(instanceId),
    selectModel: (modelId: string) => {
      const models = morphChatRegistry.get(availableModels$(instanceId))
      const target = models.find((m) => m.id === modelId)
      if (!target) return
      const rawModelId = target.modelId ?? (target.id.includes(':') ? target.id.slice(target.id.indexOf(':') + 1) : target.id)
      morphChatRegistry.set(selectedModel$(instanceId), modelId)
      morphChatRegistry.set(modelOverride$(instanceId), { provider: target.provider, modelId: rawModelId })
    },
    send: (params: SendParams) => { sendRef.current({ content: params.content, thinkingLevel: params.thinkingLevel }); return Effect.void },
    cancel: () => { cancelRef.current(undefined as void); return Effect.void },
    reconnect: () => { hardReconnect(instanceId, nodeId, role, agentName, connectRef.current); return Effect.void },
    clear: () => { clearRef.current(undefined as void); return Effect.void },
    dispose: () => { /* handled by unmount effect */ return Effect.void },
  }), [instanceId, nodeId, role, agentName])

  return {
    adapter,
    status,
    error,
    connect: doConnect,
    newSession: () => newSessionRef.current({ nodeId, role, agentName }),
    resumeSession: (sessionId: string) => resumeSessionRef.current({ sessionId }),
    hardReconnect: () => hardReconnect(instanceId, nodeId, role, agentName, connectRef.current),
  }
}

// =============================================================================
// Backward-compat: deprecated singleton aliases for default instance
// =============================================================================

const DEFAULT_ID = '__default__'

/** @deprecated Use per-instance atoms via Atom.family: messages$(instanceId) */
export const harnessMessages$ = messages$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: connection$(instanceId) */
export const harnessConnection$ = connection$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: streaming$(instanceId) */
export const harnessStreaming$ = streaming$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: agents$(instanceId) */
export const harnessAgents$ = agents$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: availableModels$(instanceId) */
export const harnessAvailableModels$ = availableModels$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: selectedModel$(instanceId) */
export const harnessSelectedModel$ = selectedModel$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: statusRows$(instanceId) */
export const harnessStatusRows$ = statusRows$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: metrics$(instanceId) */
export const harnessMetrics$ = metrics$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: provider$(instanceId) */
export const harnessProvider$ = provider$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: sessionId$(instanceId) */
export const harnessSessionId$ = sessionId$(DEFAULT_ID)
/** @deprecated Use per-instance ops via connectOp$(instanceId), sendOp$(instanceId), etc. */
export const harnessOps = {
  connect: connectOp$(DEFAULT_ID),
  send: sendOp$(DEFAULT_ID),
  cancel: cancelOp$(DEFAULT_ID),
  clear: clearOp$(DEFAULT_ID),
  dispose: disposeOp$(DEFAULT_ID),
  fetchModels: fetchModelsOp$(DEFAULT_ID),
  newSession: newSessionOp$(DEFAULT_ID),
  resumeSession: resumeSessionOp$(DEFAULT_ID),
}
