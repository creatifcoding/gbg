/**
 * Harness adapter lifecycle — infrastructure management, event wiring, layer helpers.
 *
 * The core wiring engine: connects event streams, manages tool bridges,
 * handles snapshot hydration, and provides transport/session/content layer resets.
 *
 * Depends on: atoms.ts, helpers.ts, logging.ts, panel-replay.ts
 *
 * @module morphchat/hooks/harness-adapter/lifecycle
 */

import { Effect, Fiber, Stream } from 'effect'
import {
  toolStreamSink as toolStreamSinkEffect,
  toolStreamFinalize as toolStreamFinalizeEffect,
} from '@/lib/chat/msg/tool-block/renderers/terminal/tool-stream-sink'
import { HarnessRuntimeError } from '@/lib/harness'
import type { HarnessSessionId } from '@/lib/harness/schemas'
import type { ShellEvent } from '@/lib/harness/interactive-shell/schemas'
import type { PanelEvent } from '@/lib/genifer/harness/panel-events'
import {
  dispatchShellEvent,
  registerShellCommandSender,
  clearShellCommandSender,
} from '@/lib/harness/interactive-shell/shell-session-atoms'
import { registerGeniferPanelVisitor, setGeniferPanelSurface } from '@/lib/genifer/harness/panel-visitor'
import type { GeniferSurface } from '@/lib/genifer/harness/surface'
import { spawnPanel, closePanel, getPanel } from '@/lib/floating'
import { morphChatRegistry } from '../../atoms/registry'
import { createEventProcessor } from '../../adapters/harness-event-processor'
import { createExtensionToolBridge } from '@/lib/chat/msg/tool-block/renderers/extension-tool-bridge'
import type { ChatMessage, ConnectionState } from '../../schemas/message-types'
import { DISCONNECTED, STREAMING_IDLE } from '../../schemas/message-types'
import { clearContent, ContentStoreLive } from '../../persistence/content-store'

import {
  messages$, messageIds$, connection$, streaming$, agents$,
  sessionId$, eventFiber$, shellEventFiber$, metrics$, provider$,
  contextUsage$, statusRows$, getMessageAtom, clearMessageAtoms,
  setSessionId, getSessionId,
} from './atoms'
import { pushStatusRow, formatUnknownErrorPayload } from './helpers'
import {
  morphchatLogDebug, morphchatLogWarningCause, morphchatCauseToMessage,
  isInterruptedCause, runHarnessLog,
} from './logging'
import {
  applyReplaySafeRemotePanelEvent,
  remoteToLocalPanelIds, remotePanelSurfaceIds, surfaceToLocalPanelIds,
} from './panel-replay'

// ─── Per-Instance Infrastructure ──────────────────────────────────────────────

const toolBridges = new Map<string, ReturnType<typeof createExtensionToolBridge>>()
const processors = new Map<string, ReturnType<typeof createEventProcessor>>()
export const activeWiring = new Map<string, {
  sessionId: HarnessSessionId
  shouldProcess: (event: { sessionId?: unknown; seq?: unknown }) => boolean
  processor: ReturnType<typeof createEventProcessor>
}>()

export function getToolBridge(id: string) {
  let bridge = toolBridges.get(id)
  if (!bridge) {
    bridge = createExtensionToolBridge()
    toolBridges.set(id, bridge)
  }
  return bridge
}

export function getProcessor(id: string, agentName: string) {
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
        contextUsage$: contextUsage$(id),
        statusRows$: statusRows$(id),
      },
      agentName,
      messageIds$: messageIds$(id),
      getMessageAtom: (msgId: string) => getMessageAtom(id, msgId),
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

// ─── Event Stream Wiring ──────────────────────────────────────────────────────

export function wireEventStream(
  id: string,
  activeSessionId: HarnessSessionId,
  agentName: string,
  runtime: { events: Stream.Stream<any, any>; getSnapshot: (...args: any[]) => Effect.Effect<any, any> },
  transport?: { events: Stream.Stream<unknown, any>; request: (cmd: unknown) => Effect.Effect<unknown, any> },
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
    Stream.withSpan('tmnl.morphchat.harness.event-stream', {
      attributes: {
        instanceId: id,
        sessionId: activeSessionId,
      },
    }),
    Stream.runForEach((event: any) => Effect.sync(() => processor.processEvent(event))),
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

        const currentSid = getSessionId(id)
        if (currentSid !== activeSessionId) return

        const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))
        pushStatusRow(id, { id: `status-${Date.now()}-events`, tone: 'warn', text: `[events] ${parsed.message}`, source: 'harness' })
      }),
    ),
    Effect.forkDaemon,
  )

  const shellFiberEffect = transport
    ? transport.events.pipe(
        Stream.withSpan('tmnl.morphchat.harness.transport-events', {
          attributes: {
            instanceId: id,
            sessionId: activeSessionId,
          },
        }),
        Stream.runForEach((rawEvent: any) =>
          Effect.sync(() => {
            if (rawEvent?._tag === 'remote:shell_event' && rawEvent.event) {
              dispatchShellEvent(rawEvent.event as ShellEvent)
              return
            }

            if (rawEvent?._tag === 'remote:panel_event' && rawEvent.event) {
              applyReplaySafeRemotePanelEvent(rawEvent.event as PanelEvent & { surface?: unknown }, {
                registerGeniferPanelVisitor,
                setGeniferPanelSurface: (surfaceId, surface) => setGeniferPanelSurface(surfaceId, surface as GeniferSurface),
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
      ).pipe(
        Effect.catchAllCause((cause) =>
          morphchatLogWarningCause(id, 'transport-events-stream-failed', cause, {
            sessionId: activeSessionId,
          }).pipe(Effect.asVoid),
        ),
        Effect.forkDaemon,
      )
    : Effect.succeed(null)

  if (transport) {
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
  } else {
    clearShellCommandSender()
  }

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

// ─── Layer Helpers ────────────────────────────────────────────────────────────

/** Reset transport state: connection phase, streaming, status rows, fibers, caches.
 *  Does NOT touch session identity or content. */
export function resetTransport(id: string): void {
  morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
  morphChatRegistry.set(connection$(id), DISCONNECTED)
  morphChatRegistry.set(statusRows$(id), [])
  clearShellCommandSender()
  processors.delete(id)
  activeWiring.delete(id)
}

/** Reset session identity. Does NOT touch transport or content. */
export function resetSession(id: string, reason: string): void {
  setSessionId(id, null, reason)
}

/** Reset content: messages, per-message atoms, IDs, tool bridge.
 *  This is destructive — call only for intentional clears (new session, explicit clear).
 *  Also clears persisted content from localStorage. */
export function resetContent(id: string): void {
  morphChatRegistry.set(messages$(id), [] as ReadonlyArray<ChatMessage>)
  clearMessageAtoms(id)
  morphChatRegistry.set(messageIds$(id), [])
  getToolBridge(id).clear()
  // Clear persisted content (fire-and-forget)
  Effect.runPromise(
    clearContent(id).pipe(Effect.provide(ContentStoreLive)),
  ).catch(() => { /* best-effort */ })
}

/** Snapshot content atoms for transactional rollback. */
export function snapshotContent(id: string): { rollback: () => void } {
  const prevMessages = morphChatRegistry.get(messages$(id))
  const prevMessageIds = morphChatRegistry.get(messageIds$(id))
  const prevSessionId = getSessionId(id)

  return {
    rollback: () => {
      morphChatRegistry.set(messages$(id), prevMessages)
      morphChatRegistry.set(messageIds$(id), prevMessageIds)
      for (const msg of prevMessages) {
        morphChatRegistry.set(getMessageAtom(id, msg.id), msg)
      }
      if (prevSessionId) {
        setSessionId(id, prevSessionId, `snapshotContent.rollback`)
      }
    },
  }
}

export function interruptInstanceFibers(id: string): Effect.Effect<void> {
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

    activeWiring.delete(id)
  })
}

export function activateSessionWiring(
  id: string,
  activeSessionId: HarnessSessionId,
  nodeId: string,
  agentName: string,
  runtime: { events: Stream.Stream<any, any>; getSnapshot: (...args: any[]) => Effect.Effect<any, any> },
  transport?: { events: Stream.Stream<unknown, any>; request: (cmd: unknown) => Effect.Effect<unknown, any> },
  snapshotOverride?: { events: ReadonlyArray<any> } | null,
  agentId?: string,
): Effect.Effect<void> {
  return Effect.gen(function* () {
    setSessionId(id, activeSessionId, 'activateSessionWiring')
    morphChatRegistry.set(connection$(id), { phase: 'connected', endpoint: `harness:${nodeId}` } as ConnectionState)
    morphChatRegistry.set(agents$(id), [{ id: agentId ?? nodeId, name: agentName, isActive: true }])

    const wired = wireEventStream(id, activeSessionId, agentName, runtime, transport)
    activeWiring.set(id, {
      sessionId: activeSessionId,
      shouldProcess: wired.shouldProcess,
      processor: wired.processor,
    })

    const fiber = yield* wired.eventFiberEffect
    morphChatRegistry.set(eventFiber$(id), fiber)

    const sFiber = yield* wired.shellFiberEffect
    morphChatRegistry.set(shellEventFiber$(id), sFiber)

    const snapshot = snapshotOverride === undefined
      ? yield* wired.snapshotEffect
      : snapshotOverride

    if (snapshot && getSessionId(id) === activeSessionId) {
      for (const event of snapshot.events) {
        if (wired.shouldProcess(event as any)) wired.processor.processEvent(event)
      }
    }
  })
}

// ─── Missing Import ───────────────────────────────────────────────────────────
import { Option } from 'effect'
