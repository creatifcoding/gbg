/**
 * Harness adapter operations — per-instance fn-atom ops + hard reconnect.
 *
 * Each operation is an Atom.family keyed by instanceId that closes over
 * the Effect runtime and manipulates per-instance atoms.
 *
 * Depends on: atoms.ts, helpers.ts, logging.ts, lifecycle.ts
 *
 * @module morphchat/hooks/harness-adapter/operations
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Fiber, Option } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessRuntime,
  HarnessRuntimeError,
} from '@/lib/harness'
import type {
  HarnessRole,
  HarnessSessionId,
  HarnessClientMessageId,
} from '@/lib/harness/schemas'
import type { ChatMessage, ConnectionState, StreamingState } from '../../schemas/message-types'
import { STREAMING_IDLE, finalizeAllStreamingParts, flattenPartsToText } from '../../schemas/message-types'
import type { StreamPhase } from '../../schemas/message-types'
import { morphChatRegistry } from '../../atoms/registry'

import {
  harnessRuntimeAtom, messages$, messageIds$, connection$, streaming$,
  agents$, sessionId$, eventFiber$, shellEventFiber$, statusRows$,
  availableModels$, selectedModel$, modelOverride$, cancelledAt$,
  getMessageAtom, setInstanceConfig, getInstanceConfig, setSessionId, getSessionId,
} from './atoms'
import {
  pushStatusRow, formatUnknownErrorPayload, runtimeErrorToStatus,
  toHarnessThinkingLevel,
} from './helpers'
import {
  morphchatLogDebug, morphchatLogWarningCause, morphchatCauseToMessage,
  isInterruptedCause,
} from './logging'
import {
  resetTransport, resetSession, resetContent, snapshotContent,
  interruptInstanceFibers, activateSessionWiring, activeWiring,
  getProcessor,
} from './lifecycle'
import { appendToSessionV2, unwireSessionV2 } from '@/lib/harness/session/v2/facade'

// ─── Connect ──────────────────────────────────────────────────────────────────

export const connectOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ nodeId: string; role: HarnessRole; agentName: string }>()(
    ({ nodeId, role, agentName }, _ctx) =>
      Effect.gen(function* () {
        setInstanceConfig(id, { nodeId, role, agentName })

        const runtime = yield* HarnessRuntime
        const transport = yield* HarnessBrowserTransport

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

        yield* activateSessionWiring(id, session.sessionId as HarnessSessionId, nodeId, agentName, runtime, transport, undefined, session.agentId)
        pushStatusRow(id, {
          id: `status-${Date.now()}-connect-session`,
          tone: 'info',
          text: `[connect] active session ${session.sessionId}`,
          source: 'harness',
        })

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

// ─── Fetch Models ─────────────────────────────────────────────────────────────

export const fetchModelsOp$ = Atom.family((id: string) =>
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
          reasoning: m.reasoning,
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

// ─── Send ─────────────────────────────────────────────────────────────────────

export const sendOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ content: string; thinkingLevel?: unknown }>()(
    ({ content, thinkingLevel }, _ctx) =>
      Effect.gen(function* () {
        let sid = getSessionId(id)
        const conn = morphChatRegistry.get(connection$(id)) as ConnectionState
        const runtime = yield* HarnessRuntime
        const transport = yield* HarnessBrowserTransport
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
            sid = getSessionId(id)
            if (sid) break

            const phase = (morphChatRegistry.get(connection$(id)) as ConnectionState)?.phase
            if (phase !== 'connecting' && phase !== 'reconnecting') break
          }
        }

        if (!sid) {
          const cfg = getInstanceConfig(id)
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
          yield* activateSessionWiring(id, sid, cfg.nodeId, cfg.agentName, runtime, transport, undefined, opened.agentId)

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
        // Dedup guard
        const prev = morphChatRegistry.get(messages$(id))
        if (!prev.some((m) => m.id === userMsg.id)) {
          morphChatRegistry.set(messages$(id), [...prev, userMsg])
        }

        // Session V2: shadow-write user message
        appendToSessionV2(id, { role: 'user', content, providerMessageId: clientMessageId } as any)

        const tl = toHarnessThinkingLevel(thinkingLevel)
        const override = morphChatRegistry.get(modelOverride$(id))
        if (override) morphChatRegistry.set(modelOverride$(id), null)

        yield* runtime.send(sid as HarnessSessionId, clientMessageId, content, tl, override ?? undefined)

        // Stream healing: snapshot replay after send
        const wiring = activeWiring.get(id)
        if (wiring && wiring.sessionId === sid) {
          yield* Effect.sleep('900 millis')
          const snapshot = yield* runtime.getSnapshot(sid as HarnessSessionId, Option.none()).pipe(
            Effect.catchAllCause(() => Effect.succeed(null)),
          )

          if (snapshot && getSessionId(id) === sid) {
            for (const event of snapshot.events) {
              if (wiring.shouldProcess(event as any)) {
                wiring.processor.processEvent(event as any)
              }
            }
          }
        }
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

// ─── Cancel ───────────────────────────────────────────────────────────────────

export const cancelOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      const runtime = yield* HarnessRuntime
      const sid = getSessionId(id)

      // Phase → 'cancelling'
      const current = morphChatRegistry.get(streaming$(id))
      if (current.phase !== 'idle' && current.phase !== 'error-recovery') {
        morphChatRegistry.set(streaming$(id), {
          ...current,
          phase: 'cancelling' as StreamPhase,
        })
      }

      // Stop watchdog
      const proc = getProcessor(id, '')
      if (proc) proc.stopWatchdog()

      // Finalize parts + cancel messages
      morphChatRegistry.update(messages$(id), (prev) =>
        prev.map((msg) =>
          msg.status === 'streaming'
            ? {
                ...msg,
                status: 'cancelled' as const,
                parts: finalizeAllStreamingParts(msg.parts ?? []),
                content: msg.content || flattenPartsToText(msg.parts ?? []),
              }
            : msg,
        ),
      )
      const currentMessages = morphChatRegistry.get(messages$(id))
      for (const msg of currentMessages) {
        if (msg.status === 'cancelled') {
          const msgAtom = getMessageAtom(id, msg.id)
          morphChatRegistry.set(msgAtom, msg)
        }
      }

      // Server abort
      if (sid) {
        yield* runtime.abortSession(sid).pipe(
          Effect.catchAll(() => Effect.void),
        )
      }

      // Track cancellation
      morphChatRegistry.set(cancelledAt$(id), Date.now())
      morphChatRegistry.set(streaming$(id), STREAMING_IDLE)
    }).pipe(
      Effect.catchAllCause((cause) =>
        morphchatLogWarningCause(id, 'cancel-op-failed', cause).pipe(Effect.asVoid),
      ),
    ),
  ),
)

// ─── Clear ────────────────────────────────────────────────────────────────────

export const clearOp$ = Atom.family((_id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.sync(() => {
      resetContent(_id)
      morphChatRegistry.set(streaming$(_id), STREAMING_IDLE)
      morphChatRegistry.set(statusRows$(_id), [])
    }),
  ),
)

// ─── Dispose ──────────────────────────────────────────────────────────────────

export const disposeOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<void>()((_arg, _ctx) =>
    Effect.gen(function* () {
      yield* interruptInstanceFibers(id)
      const runtime = yield* HarnessRuntime
      const sid = getSessionId(id)
      if (sid) {
        yield* runtime.abortSession(sid).pipe(
          Effect.catchAllCause((cause) =>
            morphchatLogWarningCause(id, 'dispose-abort-failed', cause, { sessionId: sid }).pipe(Effect.asVoid),
          ),
        )
      }
      resetTransport(id)
      resetSession(id, 'disposeOp.clear')
    }),
  ),
)

// ─── New Session ──────────────────────────────────────────────────────────────

export const newSessionOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ nodeId: string; role: HarnessRole; agentName: string }>()(
    ({ nodeId, role, agentName }, _ctx) => {
      let previousSid: HarnessSessionId | null = null

      return Effect.gen(function* () {
        setInstanceConfig(id, { nodeId, role, agentName })
        const runtime = yield* HarnessRuntime
        const transport = yield* HarnessBrowserTransport

        previousSid = getSessionId(id)
        yield* interruptInstanceFibers(id)

        if (previousSid) {
          yield* runtime.abortSession(previousSid).pipe(
            Effect.catchAllCause((cause) =>
              morphchatLogWarningCause(id, 'new-session-abort-old-failed', cause, { sessionId: previousSid }).pipe(Effect.asVoid),
            ),
          )
        }

        pushStatusRow(id, {
          id: `status-${Date.now()}-new-session-start`,
          tone: 'info',
          text: `[new-session] opening fresh session${previousSid ? ` (prev ${previousSid})` : ''}`,
          source: 'harness',
        })

        morphChatRegistry.set(connection$(id), { phase: 'connecting', endpoint: `harness:${nodeId}` } as ConnectionState)
        const session = yield* runtime.openSession(nodeId, role, { forceNew: true }).pipe(
          Effect.timeoutFail({ duration: '12 seconds', onTimeout: () => new HarnessRuntimeError({ code: 'new-session-timeout', message: 'Timeout', cause: Option.none() }) }),
        )

        resetTransport(id)
        resetContent(id) // Also unwires session v2 via resetContent

        yield* activateSessionWiring(id, session.sessionId as HarnessSessionId, nodeId, agentName, runtime, transport, undefined, session.agentId)
        pushStatusRow(id, {
          id: `status-${Date.now()}-new-session`,
          tone: 'info',
          text: `[new-session] active session ${session.sessionId}`,
          source: 'harness',
        })
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
              previousSessionId: previousSid ?? undefined,
            })
            const parsed = formatUnknownErrorPayload(yield* morphchatCauseToMessage(cause))

            if (previousSid) {
              setSessionId(id, previousSid, 'newSessionOp.rollback')
            }

            morphChatRegistry.set(connection$(id), { phase: 'error', error: parsed.message } as ConnectionState)
            pushStatusRow(id, { id: `status-${Date.now()}-new-session`, tone: 'error', text: `[new-session] ${parsed.message}`, source: 'harness' })
          }),
        ),
      )
    },
  ),
)

// ─── Resume Session ───────────────────────────────────────────────────────────

export const resumeSessionOp$ = Atom.family((id: string) =>
  harnessRuntimeAtom.fn<{ sessionId: string }>()(
    ({ sessionId }, _ctx) => {
      const { rollback: rollbackContent } = snapshotContent(id)

      return Effect.gen(function* () {
        const runtime = yield* HarnessRuntime
        const transport = yield* HarnessBrowserTransport
        const cfg = getInstanceConfig(id)
        if (!cfg) return yield* Effect.fail(new Error(`Missing harness config for instance: ${id}`))

        yield* interruptInstanceFibers(id)

        resetTransport(id)
        resetSession(id, 'resumeSessionOp.clear')
        resetContent(id)

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
          transport,
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
            rollbackContent()
            morphChatRegistry.set(connection$(id), { phase: 'error', error: `[${error.code}] ${error.message}` } as ConnectionState)
            pushStatusRow(id, runtimeErrorToStatus(id, 'resume-session', error))
          }),
        ),
        Effect.catchAllCause((cause) =>
          Effect.gen(function* () {
            if (isInterruptedCause(cause)) {
              rollbackContent()
              yield* morphchatLogDebug(id, 'resume-session-interrupted', {
                requestedSessionId: sessionId,
              })
              return
            }

            rollbackContent()
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
      )
    },
  ),
)

// ─── Hard Reconnect ───────────────────────────────────────────────────────────

export function hardReconnect(
  id: string,
  nodeId: string,
  role: HarnessRole,
  agentName: string,
  doConnect: (args: { nodeId: string; role: HarnessRole; agentName: string }) => void,
): void {
  const fiber = morphChatRegistry.get(eventFiber$(id))
  if (fiber) Effect.runFork(Fiber.interrupt(fiber))
  morphChatRegistry.set(eventFiber$(id), null)
  const sFiber = morphChatRegistry.get(shellEventFiber$(id))
  if (sFiber) Effect.runFork(Fiber.interrupt(sFiber))
  morphChatRegistry.set(shellEventFiber$(id), null)

  resetTransport(id)
  resetSession(id, 'hardReconnect.clear')

  morphChatRegistry.refresh(harnessRuntimeAtom)

  setTimeout(() => doConnect({ nodeId, role, agentName }), 100)
}
