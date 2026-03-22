import { Atom } from '@effect-atom/atom'
import { Effect, Layer, Match, Option, Stream } from 'effect'

import type { AgentRole } from '@/lib/conductor/schemas'
import {
  chatMessageOf,
  conductorRoleToPiRole,
  mapHarnessEventToInlineTaskEvents,
  type ConductorChatMessage,
} from './ConductorAgentChatService'
import { inlineTaskAppendEventOp } from '@/lib/conductor/atoms'
import {
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
  OverlayReducerPipeline,
  OverlayReducerPipelineLive,
  RenderNode,
  RenderOverlayOutput,
  RenderPatch,
  RenderReducerInput,
  type HarnessClientMessageId as ChatClientMessageId,
  type HarnessSessionId as ChatSessionId,
  type HarnessEvent as ChatV2Event,
  type HarnessThinkingLevel as ThinkingLevel,
  type RenderOverlayRegistration,
  type RenderReducerEmission,
} from '@/lib/harness'

const chatV2Layer = Layer.mergeAll(
  HarnessRuntimeBrowserWebSocketDefault,
  OverlayReducerPipelineLive,
)

export const conductorNodeChatRuntimeAtom = Atom.runtime(chatV2Layer)

export const nodeChatMessagesFamily = Atom.family((nodeId: string) =>
  Atom.make<ReadonlyArray<ConductorChatMessage>>([]).pipe(Atom.keepAlive),
)

export const nodeChatPendingFamily = Atom.family((nodeId: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
)

export const nodeChatErrorFamily = Atom.family((nodeId: string) =>
  Atom.make<string | null>(null).pipe(Atom.keepAlive),
)

export const nodeChatStreamingMessageIdFamily = Atom.family((nodeId: string) =>
  Atom.make<string | null>(null).pipe(Atom.keepAlive),
)

export const nodeChatStreamSubscribedFamily = Atom.family((nodeId: string) =>
  Atom.make(false).pipe(Atom.keepAlive),
)

export const nodeChatActiveAgentFamily = Atom.family((nodeId: string) =>
  Atom.make<string | null>(nodeId).pipe(Atom.keepAlive),
)

export const nodeChatSessionIdFamily = Atom.family((nodeId: string) =>
  Atom.make<string | null>(null).pipe(Atom.keepAlive),
)

export const nodeChatDraftFamily = Atom.family((nodeId: string) =>
  Atom.make('').pipe(Atom.keepAlive),
)

export const nodeChatScrollTopFamily = Atom.family((nodeId: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
)

export const nodeChatLastSeqFamily = Atom.family((nodeId: string) =>
  Atom.make<number>(0).pipe(Atom.keepAlive),
)

export const nodeChatInFlightTimingFamily = Atom.family((nodeId: string) =>
  Atom.make<NodeChatInFlightTiming | null>(null).pipe(Atom.keepAlive),
)

export const nodeChatReliabilityMetricsFamily = Atom.family((nodeId: string) =>
  Atom.make<NodeChatReliabilityMetrics>(DEFAULT_RELIABILITY_METRICS).pipe(Atom.keepAlive),
)

export const nodeChatOverlayEmissionsFamily = Atom.family((nodeId: string) =>
  Atom.make<ReadonlyArray<RenderReducerEmission>>([]).pipe(Atom.keepAlive),
)

/**
 * Encapsulated accessors for node chat atom families.
 */
export class NodeChatAtomAccessors {
  static messages(nodeId: string) {
    return nodeChatMessagesFamily(nodeId)
  }

  static pending(nodeId: string) {
    return nodeChatPendingFamily(nodeId)
  }

  static error(nodeId: string) {
    return nodeChatErrorFamily(nodeId)
  }

  static streamingMessageId(nodeId: string) {
    return nodeChatStreamingMessageIdFamily(nodeId)
  }

  static streamSubscribed(nodeId: string) {
    return nodeChatStreamSubscribedFamily(nodeId)
  }

  static activeAgent(nodeId: string) {
    return nodeChatActiveAgentFamily(nodeId)
  }

  static sessionId(nodeId: string) {
    return nodeChatSessionIdFamily(nodeId)
  }

  static draft(nodeId: string) {
    return nodeChatDraftFamily(nodeId)
  }

  static scrollTop(nodeId: string) {
    return nodeChatScrollTopFamily(nodeId)
  }

  static lastSeq(nodeId: string) {
    return nodeChatLastSeqFamily(nodeId)
  }

  static reliabilityMetrics(nodeId: string) {
    return nodeChatReliabilityMetricsFamily(nodeId)
  }

  static overlayEmissions(nodeId: string) {
    return nodeChatOverlayEmissionsFamily(nodeId)
  }

  static ensureNodeAgent(nodeId: string) {
    return ensureNodeAgentOpFamily(nodeId)
  }

  static reconnectNode(nodeId: string) {
    return reconnectNodeSessionOpFamily(nodeId)
  }

  static sendPrompt(nodeId: string) {
    return sendPromptForNodeOpFamily(nodeId)
  }

  static abortNode(nodeId: string) {
    return abortNodeSessionOpFamily(nodeId)
  }
}

export interface NodeChatSendOutcome {
  readonly requestId: string
  readonly ok: boolean
  readonly agentId: string | null
  readonly assistantText: string
  readonly error: string | null
}

export interface NodeAgentProvisionOutcome {
  readonly requestId: string
  readonly ok: boolean
  readonly agentId: string | null
  readonly error: string | null
}

export interface NodeChatReconnectOutcome {
  readonly requestId: string
  readonly ok: boolean
  readonly sessionId: ChatSessionId | null
  readonly replayedEventCount: number
  readonly error: string | null
}

export interface NodeChatAbortOutcome {
  readonly requestId: string
  readonly ok: boolean
  readonly sessionId: ChatSessionId | null
  readonly error: string | null
}

export interface NodeChatReliabilityMetrics {
  readonly sendCount: number
  readonly reconnectCount: number
  readonly snapshotResyncCount: number
  readonly replayEventCount: number
  readonly lastResumeFromSeq: number | null
  readonly lastAckLatencyMs: number | null
  readonly avgAckLatencyMs: number | null
  readonly lastFirstDeltaLagMs: number | null
  readonly avgFirstDeltaLagMs: number | null
}

interface NodeChatInFlightTiming {
  readonly startedAtMs: number
  readonly ackAtMs: number | null
  readonly firstDeltaAtMs: number | null
}

const DEFAULT_RELIABILITY_METRICS: NodeChatReliabilityMetrics = {
  sendCount: 0,
  reconnectCount: 0,
  snapshotResyncCount: 0,
  replayEventCount: 0,
  lastResumeFromSeq: null,
  lastAckLatencyMs: null,
  avgAckLatencyMs: null,
  lastFirstDeltaLagMs: null,
  avgFirstDeltaLagMs: null,
}

const ensureAssistantMessage = (
  ctx: {
    <A>(atom: any): A
    set: (atom: any, value: any) => void
  },
  nodeId: string,
  messageId: string,
  update: (existing: string) => string,
) => {
  const messages = [...ctx(nodeChatMessagesFamily(nodeId))]
  const index = messages.findIndex((entry) => entry.id === messageId)

  if (index < 0) {
    messages.push(
      chatMessageOf({
        id: messageId,
        role: 'assistant',
        text: update(''),
      }),
    )
    ctx.set(nodeChatMessagesFamily(nodeId), messages)
    return
  }

  const existing = messages[index]
  messages[index] = chatMessageOf({
    id: existing.id,
    role: 'assistant',
    text: update(existing.text),
    at: existing.at,
  })
  ctx.set(nodeChatMessagesFamily(nodeId), messages)
}

const mapThinkingLevel = (
  thinkingLevel: 'none' | 'low' | 'med' | 'high' | undefined,
): Option.Option<ThinkingLevel> => {
  if (thinkingLevel === undefined || thinkingLevel === 'med') {
    return Option.none()
  }

  return Option.some(
    Match.value(thinkingLevel).pipe(
      Match.when('none', () => 'off' as const),
      Match.when('low', () => 'low' as const),
      Match.when('med', () => 'medium' as const),
      Match.when('high', () => 'high' as const),
      Match.exhaustive,
    ),
  )
}

const updateReliabilityMetrics = (
  ctx: {
    <A>(atom: any): A
    set: (atom: any, value: any) => void
  },
  nodeId: string,
  update: (metrics: NodeChatReliabilityMetrics) => NodeChatReliabilityMetrics,
) => {
  const current = ctx(nodeChatReliabilityMetricsFamily(nodeId))
  ctx.set(nodeChatReliabilityMetricsFamily(nodeId), update(current))
}

const applySnapshotReplay = (
  ctx: {
    <A>(atom: any): A
    set: (atom: any, value: any) => void
  },
  nodeId: string,
  replay: { readonly events: ReadonlyArray<ChatV2Event> },
  lastKnownSeq: number,
) => {
  for (const event of replay.events) {
    applyChatEventToNode(ctx, nodeId, event)
  }

  updateReliabilityMetrics(ctx, nodeId, (metrics) => ({
    ...metrics,
    snapshotResyncCount: metrics.snapshotResyncCount + 1,
    replayEventCount: metrics.replayEventCount + replay.events.length,
    lastResumeFromSeq: lastKnownSeq,
  }))
}

const OVERLAY_EMISSION_HISTORY_LIMIT = 200

const CONDUCTOR_OVERLAY_ID = 'conductor.overlay.delta-lens.v1'

const CONDUCTOR_OVERLAY: RenderOverlayRegistration = {
  id: CONDUCTOR_OVERLAY_ID,
  priority: 100,
  matches: [
    { lane: 'text', class: 'delta' },
    { lane: 'thinking', class: 'delta' },
    { lane: 'tool', class: 'tool' },
    { lane: 'control', class: 'terminal' },
    { lane: 'control', class: 'error' },
    { lane: 'extension', class: 'extension' },
  ],
  run: (batch) =>
    Effect.succeed(
      new RenderOverlayOutput({
        overlayId: CONDUCTOR_OVERLAY_ID,
        lane: 'control',
        patches: batch.map(
          (entry) =>
            new RenderPatch({
              path: `/overlay/${entry.lane}`,
              op: entry.class === 'delta' ? 'append' : 'set',
              value: {
                seq: entry.seq,
                tag: entry.tag,
                class: entry.class,
              },
              lane: entry.lane,
              overlayId: CONDUCTOR_OVERLAY_ID,
            }),
        ),
        nodes: batch
          .filter((entry) => entry.class === 'terminal' || entry.class === 'error')
          .map(
            (entry) =>
              new RenderNode({
                id: `${CONDUCTOR_OVERLAY_ID}:${entry.seq}`,
                kind: 'overlay-terminal',
                lane: entry.lane,
                props: {
                  tag: entry.tag,
                  class: entry.class,
                },
                children: [],
              }),
          ),
        diagnostics: [],
      }),
    ),
}

const appendOverlayEmission = (
  ctx: {
    <A>(atom: any): A
    set: (atom: any, value: any) => void
  },
  nodeId: string,
  emission: RenderReducerEmission,
) => {
  const current = ctx(nodeChatOverlayEmissionsFamily(nodeId))
  const next = [...current, emission]
  ctx.set(nodeChatOverlayEmissionsFamily(nodeId), next.slice(-OVERLAY_EMISSION_HISTORY_LIMIT))
}

const toRenderReducerInput = (event: ChatV2Event): Option.Option<RenderReducerInput> => {
  const messageId =
    typeof (event as { messageId?: unknown }).messageId === 'string'
      ? ((event as { messageId: string }).messageId as any)
      : undefined

  switch (event._tag) {
    case 'chat:v2/provider_marker': {
      switch (event.marker._tag) {
        case 'provider:marker/text_delta':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'text',
              class: 'delta',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/thinking_delta':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'thinking',
              class: 'delta',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/toolcall_start':
        case 'provider:marker/toolcall_delta':
        case 'provider:marker/toolcall_end':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'tool',
              class: 'tool',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/error':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'control',
              class: 'error',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/done':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'control',
              class: 'terminal',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/start':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'control',
              class: 'control',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/text_start':
        case 'provider:marker/text_end':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'text',
              class: event.marker._tag === 'provider:marker/text_end' ? 'terminal' : 'control',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        case 'provider:marker/thinking_start':
        case 'provider:marker/thinking_end':
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'thinking',
              class: event.marker._tag === 'provider:marker/thinking_end' ? 'terminal' : 'control',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
        default:
          return Option.some(
            new RenderReducerInput({
              sessionId: event.sessionId,
              messageId,
              seq: event.seq,
              at: event.at,
              lane: 'unknown',
              class: 'unknown',
              tag: event.marker._tag,
              payload: event.marker,
            }),
          )
      }
    }

    case 'chat:v2/assistant_delta':
      return Option.some(
        new RenderReducerInput({
          sessionId: event.sessionId,
          messageId: event.messageId as any,
          seq: event.seq,
          at: event.at,
          lane: 'text',
          class: 'delta',
          tag: event._tag,
          payload: event,
        }),
      )

    case 'chat:v2/assistant_thinking_delta':
      return Option.some(
        new RenderReducerInput({
          sessionId: event.sessionId,
          messageId: event.messageId as any,
          seq: event.seq,
          at: event.at,
          lane: 'thinking',
          class: 'delta',
          tag: event._tag,
          payload: event,
        }),
      )

    case 'chat:v2/assistant_final':
      return Option.some(
        new RenderReducerInput({
          sessionId: event.sessionId,
          messageId: event.messageId as any,
          seq: event.seq,
          at: event.at,
          lane: 'text',
          class: 'terminal',
          tag: event._tag,
          payload: event,
        }),
      )

    case 'chat:v2/tool_event':
      return Option.some(
        new RenderReducerInput({
          sessionId: event.sessionId,
          messageId,
          seq: event.seq,
          at: event.at,
          lane: 'tool',
          class: 'tool',
          tag: event._tag,
          payload: event,
        }),
      )

    case 'chat:v2/error':
      return Option.some(
        new RenderReducerInput({
          sessionId: event.sessionId,
          messageId,
          seq: event.seq,
          at: event.at,
          lane: 'control',
          class: 'error',
          tag: event._tag,
          payload: event,
        }),
      )

    default:
      return Option.none()
  }
}

const applyChatEventToNode = (
  ctx: {
    <A>(atom: any): A
    set: (atom: any, value: any) => void
  },
  nodeId: string,
  event: ChatV2Event,
) => {
  const lastSeq = ctx(nodeChatLastSeqFamily(nodeId))
  if (typeof event.seq === 'number' && event.seq <= lastSeq) {
    return
  }

  if (typeof event.seq === 'number') {
    ctx.set(nodeChatLastSeqFamily(nodeId), event.seq)
  }

  switch (event._tag) {
    case 'chat:v2/session_opened': {
      ctx.set(nodeChatActiveAgentFamily(nodeId), event.agentId)
      ctx.set(nodeChatErrorFamily(nodeId), null)
      break
    }

    case 'chat:v2/send_accepted': {
      ctx.set(nodeChatPendingFamily(nodeId), true)

      const inFlight = ctx(nodeChatInFlightTimingFamily(nodeId))
      if (inFlight !== null) {
        const ackAtMs = Date.now()
        const ackLatencyMs = Math.max(0, ackAtMs - inFlight.startedAtMs)

        ctx.set(nodeChatInFlightTimingFamily(nodeId), {
          ...inFlight,
          ackAtMs,
        })

        updateReliabilityMetrics(ctx, nodeId, (metrics) => {
          const previousSamples = Math.max(0, metrics.sendCount - 1)
          const avgAckLatencyMs =
            previousSamples === 0 || metrics.avgAckLatencyMs === null
              ? ackLatencyMs
              : (metrics.avgAckLatencyMs * previousSamples + ackLatencyMs) / (previousSamples + 1)

          return {
            ...metrics,
            lastAckLatencyMs: ackLatencyMs,
            avgAckLatencyMs,
          }
        })
      }
      break
    }

    case 'chat:v2/assistant_start': {
      ctx.set(nodeChatPendingFamily(nodeId), true)
      ctx.set(nodeChatStreamingMessageIdFamily(nodeId), event.messageId)
      ensureAssistantMessage(ctx, nodeId, event.messageId, (existing) => existing)

      const inFlight = ctx(nodeChatInFlightTimingFamily(nodeId))
      if (inFlight !== null && inFlight.ackAtMs !== null && inFlight.firstDeltaAtMs === null) {
        const firstDeltaAtMs = Date.now()
        const firstDeltaLagMs = Math.max(0, firstDeltaAtMs - inFlight.ackAtMs)

        ctx.set(nodeChatInFlightTimingFamily(nodeId), {
          ...inFlight,
          firstDeltaAtMs,
        })

        updateReliabilityMetrics(ctx, nodeId, (metrics) => {
          const previousSamples = Math.max(0, metrics.sendCount - 1)
          const avgFirstDeltaLagMs =
            previousSamples === 0 || metrics.avgFirstDeltaLagMs === null
              ? firstDeltaLagMs
              : (metrics.avgFirstDeltaLagMs * previousSamples + firstDeltaLagMs) / (previousSamples + 1)

          return {
            ...metrics,
            lastFirstDeltaLagMs: firstDeltaLagMs,
            avgFirstDeltaLagMs,
          }
        })
      }
      break
    }

    case 'chat:v2/assistant_delta': {
      ctx.set(nodeChatPendingFamily(nodeId), true)
      ctx.set(nodeChatStreamingMessageIdFamily(nodeId), event.messageId)
      ensureAssistantMessage(ctx, nodeId, event.messageId, (existing) => `${existing}${event.delta}`)

      const inFlight = ctx(nodeChatInFlightTimingFamily(nodeId))
      if (inFlight !== null && inFlight.ackAtMs !== null && inFlight.firstDeltaAtMs === null) {
        const firstDeltaAtMs = Date.now()
        const firstDeltaLagMs = Math.max(0, firstDeltaAtMs - inFlight.ackAtMs)

        ctx.set(nodeChatInFlightTimingFamily(nodeId), {
          ...inFlight,
          firstDeltaAtMs,
        })

        updateReliabilityMetrics(ctx, nodeId, (metrics) => {
          const previousSamples = Math.max(0, metrics.sendCount - 1)
          const avgFirstDeltaLagMs =
            previousSamples === 0 || metrics.avgFirstDeltaLagMs === null
              ? firstDeltaLagMs
              : (metrics.avgFirstDeltaLagMs * previousSamples + firstDeltaLagMs) / (previousSamples + 1)

          return {
            ...metrics,
            lastFirstDeltaLagMs: firstDeltaLagMs,
            avgFirstDeltaLagMs,
          }
        })
      }
      break
    }

    case 'chat:v2/tool_event': {
      const inlineTaskEvents = mapHarnessEventToInlineTaskEvents({
        nodeId,
        event,
        messageAnchorId: ctx(nodeChatStreamingMessageIdFamily(nodeId)),
      })

      for (const inlineTaskEvent of inlineTaskEvents) {
        ctx.set(inlineTaskAppendEventOp, inlineTaskEvent)
      }
      break
    }

    case 'chat:v2/assistant_final': {
      ensureAssistantMessage(ctx, nodeId, event.messageId, () => event.text)
      ctx.set(nodeChatPendingFamily(nodeId), false)
      ctx.set(nodeChatStreamingMessageIdFamily(nodeId), null)
      ctx.set(nodeChatInFlightTimingFamily(nodeId), null)
      break
    }

    case 'chat:v2/error': {
      const message = `${event.code}: ${event.message}`
      ctx.set(nodeChatMessagesFamily(nodeId), [
        ...ctx(nodeChatMessagesFamily(nodeId)),
        chatMessageOf({
          role: 'system',
          text: `error: ${message}`,
        }),
      ])
      ctx.set(nodeChatPendingFamily(nodeId), false)
      ctx.set(nodeChatStreamingMessageIdFamily(nodeId), null)
      ctx.set(nodeChatInFlightTimingFamily(nodeId), null)
      ctx.set(nodeChatErrorFamily(nodeId), message)
      break
    }

    default:
      break
  }
}

const ensureSessionAndSubscription = (
  nodeId: string,
  role: AgentRole,
  ctx: {
    <A>(atom: any): A
    set: (atom: any, value: any) => void
  },
): Effect.Effect<
  { readonly sessionId: ChatSessionId; readonly agentId: string },
  unknown,
  HarnessRuntime | OverlayReducerPipeline
> =>
  Effect.gen(function* () {
    const client = yield* HarnessRuntime
    const pipeline = yield* OverlayReducerPipeline
    const mappedRole = conductorRoleToPiRole(role)

    const existing = ctx(nodeChatSessionIdFamily(nodeId))
    const lastKnownSeq = ctx(nodeChatLastSeqFamily(nodeId))

    const opened =
      existing === null
        ? yield* client.openSession(nodeId, mappedRole)
        : {
            sessionId: existing as ChatSessionId,
            nodeId,
            role,
            agentId: ctx(nodeChatActiveAgentFamily(nodeId)) ?? nodeId,
            headSeq: lastKnownSeq,
          }

    if (!ctx(nodeChatStreamSubscribedFamily(nodeId))) {
      yield* pipeline.register(CONDUCTOR_OVERLAY)

      yield* Effect.forkScoped(
        Stream.runForEach(pipeline.outputs, (emission) =>
          Effect.sync(() => {
            const currentSession = ctx(nodeChatSessionIdFamily(nodeId))
            if (!currentSession || emission.sessionId !== currentSession) {
              return
            }
            appendOverlayEmission(ctx, nodeId, emission)
          }),
        ),
      )

      yield* Effect.forkScoped(
        Stream.runForEach(client.events, (event) =>
          Effect.gen(function* () {
            const currentSession = ctx(nodeChatSessionIdFamily(nodeId))
            if (!currentSession || event.sessionId !== currentSession) {
              return
            }

            const renderInput = toRenderReducerInput(event)
            if (Option.isSome(renderInput)) {
              yield* pipeline.ingest(renderInput.value)
            }

            yield* Effect.sync(() => {
              applyChatEventToNode(ctx, nodeId, event)
            })
          }),
        ).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              const message =
                typeof (error as { message?: unknown }).message === 'string'
                  ? (error as { message: string }).message
                  : String(error)

              ctx.set(nodeChatStreamSubscribedFamily(nodeId), false)
              ctx.set(nodeChatErrorFamily(nodeId), message)
              ctx.set(nodeChatMessagesFamily(nodeId), [
                ...ctx(nodeChatMessagesFamily(nodeId)),
                chatMessageOf({
                  role: 'system',
                  text: `stream-error: ${message}`,
                }),
              ])
            }),
          ),
        ),
      )
      ctx.set(nodeChatStreamSubscribedFamily(nodeId), true)
    }

    const replayResult = yield* (existing === null
      ? client.getSnapshot(opened.sessionId, Option.some(lastKnownSeq)).pipe(
          Effect.map((replay) => ({
            _tag: 'ok' as const,
            opened,
            replay,
          })),
        )
      : client.resumeSession(opened.sessionId, Option.some(lastKnownSeq)).pipe(
          Effect.map((replay) => ({
            _tag: 'ok' as const,
            opened,
            replay,
          })),
          Effect.catchAll(() =>
            Effect.gen(function* () {
              const reopened = yield* client.openSession(nodeId, mappedRole)
              const replay = yield* client.getSnapshot(reopened.sessionId, Option.none())

              ctx.set(nodeChatMessagesFamily(nodeId), [
                ...ctx(nodeChatMessagesFamily(nodeId)),
                chatMessageOf({
                  role: 'system',
                  text: 'session resynced after reconnect',
                }),
              ])
              ctx.set(nodeChatLastSeqFamily(nodeId), 0)

              return {
                _tag: 'ok' as const,
                opened: reopened,
                replay,
              }
            }),
          ),
        ))

    ctx.set(nodeChatSessionIdFamily(nodeId), replayResult.opened.sessionId)
    ctx.set(nodeChatActiveAgentFamily(nodeId), replayResult.opened.agentId)

    applySnapshotReplay(ctx, nodeId, replayResult.replay, lastKnownSeq)
    ctx.set(nodeChatErrorFamily(nodeId), null)

    return {
      sessionId: replayResult.opened.sessionId,
      agentId: replayResult.opened.agentId,
    }
  })

export const ensureNodeAgentOpFamily = Atom.family((nodeId: string) =>
  conductorNodeChatRuntimeAtom.fn<{
    requestId: string
    role: AgentRole
  }>()(({ requestId, role }, ctx) =>
    ensureSessionAndSubscription(nodeId, role, ctx).pipe(
      Effect.match({
        onFailure: (error) => {
          const message =
            typeof (error as { message?: unknown }).message === 'string'
              ? (error as { message: string }).message
              : String(error)

          ctx.set(nodeChatErrorFamily(nodeId), message)
          return {
            requestId,
            ok: false,
            agentId: null,
            error: message,
          } satisfies NodeAgentProvisionOutcome
        },
        onSuccess: (value) => {
          ctx.set(nodeChatErrorFamily(nodeId), null)
          return {
            requestId,
            ok: true,
            agentId: value.agentId,
            error: null,
          } satisfies NodeAgentProvisionOutcome
        },
      }),
    ),
  ),
)

export const reconnectNodeSessionOpFamily = Atom.family((nodeId: string) =>
  conductorNodeChatRuntimeAtom.fn<{
    requestId: string
    role: AgentRole
  }>()(({ requestId, role }, ctx) =>
    Effect.gen(function* () {
      updateReliabilityMetrics(ctx, nodeId, (metrics) => ({
        ...metrics,
        reconnectCount: metrics.reconnectCount + 1,
      }))

      const ready = yield* ensureSessionAndSubscription(nodeId, role, ctx).pipe(
        Effect.match({
          onFailure: (error) => ({ _tag: 'error' as const, error }),
          onSuccess: (value) => ({ _tag: 'success' as const, value }),
        }),
      )

      if (ready._tag === 'error') {
        const message =
          typeof (ready.error as { message?: unknown }).message === 'string'
            ? (ready.error as { message: string }).message
            : String(ready.error)

        ctx.set(nodeChatErrorFamily(nodeId), message)

        return {
          requestId,
          ok: false,
          sessionId: null,
          replayedEventCount: 0,
          error: message,
        } satisfies NodeChatReconnectOutcome
      }

      const replayedEventCount = ctx(nodeChatReliabilityMetricsFamily(nodeId)).replayEventCount

      return {
        requestId,
        ok: true,
        sessionId: ready.value.sessionId,
        replayedEventCount,
        error: null,
      } satisfies NodeChatReconnectOutcome
    }),
  ),
)

export const abortNodeSessionOpFamily = Atom.family((nodeId: string) =>
  conductorNodeChatRuntimeAtom.fn<{
    requestId: string
  }>()(({ requestId }, ctx) =>
    Effect.gen(function* () {
      const sessionId = ctx(nodeChatSessionIdFamily(nodeId))
      if (!sessionId) {
        return {
          requestId,
          ok: false,
          sessionId: null,
          error: 'no active session',
        } satisfies NodeChatAbortOutcome
      }

      const client = yield* HarnessRuntime
      const aborted = yield* client.abortSession(sessionId as ChatSessionId).pipe(
        Effect.match({
          onFailure: (error) => ({ _tag: 'error' as const, error }),
          onSuccess: () => ({ _tag: 'success' as const }),
        }),
      )

      if (aborted._tag === 'error') {
        const message =
          typeof (aborted.error as { message?: unknown }).message === 'string'
            ? (aborted.error as { message: string }).message
            : String(aborted.error)

        ctx.set(nodeChatErrorFamily(nodeId), message)

        return {
          requestId,
          ok: false,
          sessionId: sessionId as ChatSessionId,
          error: message,
        } satisfies NodeChatAbortOutcome
      }

      ctx.set(nodeChatPendingFamily(nodeId), false)
      ctx.set(nodeChatStreamingMessageIdFamily(nodeId), null)
      ctx.set(nodeChatInFlightTimingFamily(nodeId), null)
      ctx.set(nodeChatErrorFamily(nodeId), null)

      return {
        requestId,
        ok: true,
        sessionId: sessionId as ChatSessionId,
        error: null,
      } satisfies NodeChatAbortOutcome
    }),
  ),
)

export const sendPromptForNodeOpFamily = Atom.family((nodeId: string) =>
  conductorNodeChatRuntimeAtom.fn<{
    requestId: string
    role: AgentRole
    prompt: string
    thinkingLevel?: 'none' | 'low' | 'med' | 'high'
  }>()(({ requestId, role, prompt, thinkingLevel }, ctx) =>
    Effect.gen(function* () {
      const userMessage = chatMessageOf({
        role: 'user',
        text: prompt,
      })

      ctx.set(nodeChatMessagesFamily(nodeId), [
        ...ctx(nodeChatMessagesFamily(nodeId)),
        userMessage,
      ])
      ctx.set(nodeChatPendingFamily(nodeId), true)
      ctx.set(nodeChatErrorFamily(nodeId), null)
      ctx.set(nodeChatInFlightTimingFamily(nodeId), {
        startedAtMs: Date.now(),
        ackAtMs: null,
        firstDeltaAtMs: null,
      })

      updateReliabilityMetrics(ctx, nodeId, (metrics) => ({
        ...metrics,
        sendCount: metrics.sendCount + 1,
      }))

      const ready = yield* ensureSessionAndSubscription(nodeId, role, ctx).pipe(
        Effect.match({
          onFailure: (error) => ({ _tag: 'error' as const, error }),
          onSuccess: (value) => ({ _tag: 'success' as const, value }),
        }),
      )

      if (ready._tag === 'error') {
        const message =
          typeof (ready.error as { message?: unknown }).message === 'string'
            ? (ready.error as { message: string }).message
            : String(ready.error)

        ctx.set(nodeChatPendingFamily(nodeId), false)
        ctx.set(nodeChatInFlightTimingFamily(nodeId), null)
        ctx.set(nodeChatErrorFamily(nodeId), message)

        return {
          requestId,
          ok: false,
          agentId: null,
          assistantText: '',
          error: message,
        } satisfies NodeChatSendOutcome
      }

      const client = yield* HarnessRuntime
      const sendResult = yield* client
        .send(
          ready.value.sessionId,
          `client-${requestId}` as ChatClientMessageId,
          prompt,
          mapThinkingLevel(thinkingLevel),
        )
        .pipe(
          Effect.match({
            onFailure: (error) => ({ _tag: 'error' as const, error }),
            onSuccess: (value) => ({ _tag: 'success' as const, value }),
          }),
        )

      if (sendResult._tag === 'error') {
        const message =
          typeof (sendResult.error as { message?: unknown }).message === 'string'
            ? (sendResult.error as { message: string }).message
            : String(sendResult.error)

        ctx.set(nodeChatMessagesFamily(nodeId), [
          ...ctx(nodeChatMessagesFamily(nodeId)),
          chatMessageOf({
            role: 'system',
            text: `error: ${message}`,
          }),
        ])
        ctx.set(nodeChatPendingFamily(nodeId), false)
        ctx.set(nodeChatStreamingMessageIdFamily(nodeId), null)
        ctx.set(nodeChatInFlightTimingFamily(nodeId), null)
        ctx.set(nodeChatErrorFamily(nodeId), message)

        return {
          requestId,
          ok: false,
          agentId: null,
          assistantText: '',
          error: message,
        } satisfies NodeChatSendOutcome
      }

      return {
        requestId,
        ok: true,
        agentId: ready.value.agentId,
        assistantText: '',
        error: null,
      } satisfies NodeChatSendOutcome
    }),
  ),
)
