/**
 * PiProvider
 *
 * ChatDataProvider implementation backed by HarnessRuntime (pi-ai core runtime).
 * This removes direct pi-orchestrator coupling from provider runtime behavior.
 */

import { nanoid } from 'nanoid'
import { Context, Effect, Layer, Match, Option, PubSub, Ref, Stream } from 'effect'

import {
  ChatDataProvider,
  ChatSendError,
  ExtensionUIRequest,
  ExtensionUIResponse,
  ProviderNotConfiguredError,
  ProviderState,
  SendMessageOptions,
  type ChatDataProviderShape,
} from '../ChatDataProvider'
import { ChatMessage, ToolCallInfo, createUserMessage } from '../../types'
import {
  HarnessRuntime,
  HarnessMetricEvent,
  HarnessRuntimeBrowserLive,
  HarnessRuntimeBrowserWebSocketDefault,
  OverlayReducerPipeline,
  OverlayReducerPipelineLive,
  RenderNode,
  RenderOverlayOutput,
  RenderPatch,
  RenderReducerInput,
  makeHarnessBrowserTransportLayer,
  type HarnessBrowserTransportConfigShape,
  type HarnessRuntimeShape,
  type HarnessRole,
  type HarnessSessionId,
  type HarnessEvent,
  type HarnessExtensionUIResponse,
  type OverlayReducerPipelineShape,
  type RenderOverlayRegistration,
} from '../../../harness'

// =============================================================================
// Config
// =============================================================================

export interface PiProviderConfigShape {
  readonly nodeId: string
  readonly role: HarnessRole
}

export const PiProviderConfig = Context.GenericTag<PiProviderConfigShape>('tmnl/ai-core/PiProviderConfig')

export const PiProviderConfigDefault = Layer.succeed(PiProviderConfig, {
  nodeId: 'cop-chat-default',
  role: 'general' as const,
})

// =============================================================================
// Internal State
// =============================================================================

interface PiBridgeState {
  readonly sessionId: HarnessSessionId | null
  readonly messages: readonly ChatMessage[]
  readonly isStreaming: boolean
  readonly error: string | null
  readonly streamingMessageId: string | null
  readonly pendingExtensionUI: readonly ExtensionUIRequest[]
  readonly metrics: Readonly<Record<string, number>>
}

const initialState = (sessionId: HarnessSessionId | null = null): PiBridgeState => ({
  sessionId,
  messages: [],
  isStreaming: false,
  error: null,
  streamingMessageId: null,
  pendingExtensionUI: [],
  metrics: {},
})

const toProviderState = (state: PiBridgeState): ProviderState =>
  new ProviderState({
    status: state.error ? 'error' : state.isStreaming ? 'streaming' : 'idle',
    messages: state.messages as unknown[],
    error: state.error,
    isStreaming: state.isStreaming,
    streamingMessageId: state.streamingMessageId,
  })

const mkAssistantMessage = (id: string, text = '', thinking: string | null = null): ChatMessage =>
  new ChatMessage({
    id,
    role: 'assistant',
    text,
    thinking,
    toolCalls: [],
    isStreaming: true,
    createdAt: Date.now(),
  })

const ensureAssistantById = (
  state: PiBridgeState,
  assistantId: string,
): PiBridgeState => {
  const existing = state.messages.find((m) => m.id === assistantId && m.role === 'assistant')
  if (existing) {
    return {
      ...state,
      isStreaming: true,
      streamingMessageId: assistantId,
      messages: state.messages.map((m) =>
        m.id === assistantId ? new ChatMessage({ ...m, isStreaming: true }) : m,
      ),
    }
  }

  return {
    ...state,
    isStreaming: true,
    streamingMessageId: assistantId,
    messages: [...state.messages, mkAssistantMessage(assistantId)],
  }
}

const updateAssistant = (
  state: PiBridgeState,
  assistantId: string,
  update: (msg: ChatMessage) => ChatMessage,
): PiBridgeState => ({
  ...state,
  messages: state.messages.map((m) => (m.id === assistantId ? update(m) : m)),
})

const upsertToolCall = (
  msg: ChatMessage,
  toolCallId: string,
  update: (current: ToolCallInfo | null) => ToolCallInfo,
): ChatMessage => {
  const current = msg.toolCalls.find((tc) => tc.toolCallId === toolCallId) ?? null
  const next = update(current)

  return new ChatMessage({
    ...msg,
    toolCalls: current
      ? msg.toolCalls.map((tc) => (tc.toolCallId === toolCallId ? next : tc))
      : [...msg.toolCalls, next],
    isStreaming: true,
  })
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const PI_PROVIDER_OVERLAY_ID = 'pi-provider.overlay.delta-lens.v1'

const PI_PROVIDER_OVERLAY: RenderOverlayRegistration = {
  id: PI_PROVIDER_OVERLAY_ID,
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
        overlayId: PI_PROVIDER_OVERLAY_ID,
        lane: 'control',
        patches: [
          new RenderPatch({
            path: '/pi-provider/overlay',
            op: 'append',
            value: {
              batchSize: batch.length,
              seqHighWatermark: batch[batch.length - 1]?.seq ?? 0,
            },
            lane: 'control',
            overlayId: PI_PROVIDER_OVERLAY_ID,
          }),
        ],
        nodes: batch
          .filter((entry) => entry.class === 'error' || entry.class === 'terminal')
          .map(
            (entry) =>
              new RenderNode({
                id: `${PI_PROVIDER_OVERLAY_ID}:${entry.seq}`,
                kind: 'pi-provider-overlay-terminal',
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

const toRenderReducerInput = (event: HarnessEvent): Option.Option<RenderReducerInput> => {
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

const applyHarnessEvent = (state: PiBridgeState, event: HarnessEvent): PiBridgeState =>
  Match.value(event._tag).pipe(
    Match.when('chat:v2/send_accepted', () => ({
      ...state,
      isStreaming: true,
      error: null,
    })),
    Match.when('chat:v2/assistant_start', () => ensureAssistantById(state, event.messageId)),
    Match.when('chat:v2/assistant_delta', () => {
      const ensured = ensureAssistantById(state, event.messageId)
      return updateAssistant(ensured, event.messageId, (msg) =>
        new ChatMessage({
          ...msg,
          text: `${msg.text ?? ''}${event.delta}`,
          isStreaming: true,
        }),
      )
    }),
    Match.when('chat:v2/assistant_thinking_delta', () => {
      const ensured = ensureAssistantById(state, event.messageId)
      return updateAssistant(ensured, event.messageId, (msg) =>
        new ChatMessage({
          ...msg,
          thinking: `${msg.thinking ?? ''}${event.delta}`,
          isStreaming: true,
        }),
      )
    }),
    Match.when('chat:v2/tool_event', () => {
      const ensured = ensureAssistantById(state, state.streamingMessageId ?? `assistant-${Date.now()}`)
      const assistantId = ensured.streamingMessageId ?? `assistant-${Date.now()}`

      if (event.phase === 'start') {
        return updateAssistant(ensured, assistantId, (msg) =>
          upsertToolCall(msg, event.toolCallId, (current) =>
            new ToolCallInfo({
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: current?.args ?? {},
              status: 'running',
              result: current?.result ?? null,
              errorText: null,
            }),
          ),
        )
      }

      if (event.phase === 'update') {
        const payload = asRecord(event.payload)
        const delta = asString(payload?.delta)

        return updateAssistant(ensured, assistantId, (msg) =>
          upsertToolCall(msg, event.toolCallId, (current) => {
            const partialPrev = asRecord(current?.result)?.partial
            const partialText = typeof partialPrev === 'string' ? partialPrev : ''

            return new ToolCallInfo({
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: current?.args ?? {},
              status: 'running',
              result: delta === null ? current?.result ?? null : { partial: `${partialText}${delta}` },
              errorText: null,
            })
          }),
        )
      }

      const payload = asRecord(event.payload)
      const args = payload?.arguments ?? {}

      return updateAssistant(ensured, assistantId, (msg) =>
        upsertToolCall(msg, event.toolCallId, (current) =>
          new ToolCallInfo({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args,
            status: 'complete',
            result: current?.result ?? payload?.result ?? null,
            errorText: null,
          }),
        ),
      )
    }),
    Match.when('chat:v2/assistant_final', () => {
      const ensured = ensureAssistantById(state, event.messageId)
      const finalized = updateAssistant(ensured, event.messageId, (msg) =>
        new ChatMessage({
          ...msg,
          text: event.text,
          isStreaming: false,
        }),
      )

      return {
        ...finalized,
        isStreaming: false,
        streamingMessageId: null,
      }
    }),
    Match.when('chat:v2/metric', () => ({
      ...state,
      metrics: {
        ...state.metrics,
        [event.metric]: event.value,
      },
    })),
    Match.when('chat:v2/error', () => ({
      ...state,
      error: event.message,
      isStreaming: false,
      streamingMessageId: null,
    })),
    Match.orElse(() => state),
  )

const replaySnapshotState = (
  state: PiBridgeState,
  events: ReadonlyArray<HarnessEvent>,
): PiBridgeState =>
  events.reduce((current, event) => applyHarnessEvent(current, event), state)

const ingestRenderInputs = (
  reducer: OverlayReducerPipelineShape,
  events: ReadonlyArray<HarnessEvent>,
): Effect.Effect<void> =>
  Effect.forEach(
    events,
    (event) => {
      const renderInput = toRenderReducerInput(event)
      return Option.isSome(renderInput) ? reducer.ingest(renderInput.value) : Effect.void
    },
    { discard: true },
  )

// =============================================================================
// State Sync
// =============================================================================

const publishState = (
  stateRef: Ref.Ref<PiBridgeState>,
  pubsub: PubSub.PubSub<ProviderState>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    yield* PubSub.publish(pubsub, toProviderState(state))
  }).pipe(Effect.asVoid)

const eventLoop = (
  runtime: HarnessRuntimeShape,
  reducer: OverlayReducerPipelineShape,
  activeSessionRef: Ref.Ref<HarnessSessionId>,
  lastAppliedSeqRef: Ref.Ref<number>,
  stateRef: Ref.Ref<PiBridgeState>,
  pubsub: PubSub.PubSub<ProviderState>,
): Effect.Effect<void> =>
  Stream.runForEach(runtime.events, (event) =>
    Effect.gen(function* () {
      const activeSession = yield* Ref.get(activeSessionRef)
      if (event.sessionId !== activeSession) {
        return
      }

      const renderInput = toRenderReducerInput(event)
      if (Option.isSome(renderInput)) {
        yield* reducer.ingest(renderInput.value)
      }

      const shouldApply = yield* Ref.modify(lastAppliedSeqRef, (lastSeq) =>
        event.seq > lastSeq ? [true, event.seq] as const : [false, lastSeq] as const,
      )

      if (!shouldApply) {
        return
      }

      const next = yield* Ref.updateAndGet(stateRef, (s) => applyHarnessEvent(s, event))
      yield* PubSub.publish(pubsub, toProviderState(next))
    }).pipe(Effect.asVoid),
  )

const reducerMetricLoop = (
  reducer: OverlayReducerPipelineShape,
  activeSessionRef: Ref.Ref<HarnessSessionId>,
  stateRef: Ref.Ref<PiBridgeState>,
  pubsub: PubSub.PubSub<ProviderState>,
): Effect.Effect<void> =>
  Stream.runForEach(reducer.outputs, (emission) =>
    Effect.gen(function* () {
      const activeSession = yield* Ref.get(activeSessionRef)
      if (emission.sessionId !== activeSession) {
        return
      }

      const now = Date.now()
      const metricEvents = [
        HarnessMetricEvent.make({
          sessionId: emission.sessionId,
          seq: emission.seqHighWatermark,
          at: now,
          metric: 'renderTransformBatchMs',
          value: emission.transformMs,
        }),
        HarnessMetricEvent.make({
          sessionId: emission.sessionId,
          seq: emission.seqHighWatermark,
          at: now,
          metric: 'renderBacklogDepth',
          value: emission.backlogDepth,
          details: {
            batchSize: emission.batchSize,
            bucketKey: emission.bucketKey,
            overlays: emission.overlays,
          },
        }),
      ] as const

      for (const metricEvent of metricEvents) {
        const next = yield* Ref.updateAndGet(stateRef, (s) => applyHarnessEvent(s, metricEvent))
        yield* PubSub.publish(pubsub, toProviderState(next))
      }
    }).pipe(Effect.asVoid),
  )

const mapSendError = (message: string, cause: unknown): ChatSendError =>
  new ChatSendError({
    message,
    cause: Option.some(cause),
  })

const toHarnessExtensionUIResponse = (
  response: ExtensionUIResponse,
): HarnessExtensionUIResponse =>
  Match.value(response.kind).pipe(
    Match.when('value', () => ({
      _tag: 'pi:extension_ui_response:value' as const,
      requestId: response.requestId,
      value: Option.getOrElse(response.value, () => ''),
    })),
    Match.when('confirm', () => ({
      _tag: 'pi:extension_ui_response:confirm' as const,
      requestId: response.requestId,
      confirmed: Option.getOrElse(response.confirmed, () => false),
    })),
    Match.when('cancel', () => ({
      _tag: 'pi:extension_ui_response:cancel' as const,
      requestId: response.requestId,
      cancelled: true,
    })),
    Match.exhaustive,
  )

// =============================================================================
// Provider
// =============================================================================

const createPiProviderShape = (
  cfg: PiProviderConfigShape,
  runtime: HarnessRuntimeShape,
  reducer: OverlayReducerPipelineShape,
  activeSessionRef: Ref.Ref<HarnessSessionId>,
  lastAppliedSeqRef: Ref.Ref<number>,
  stateRef: Ref.Ref<PiBridgeState>,
  pubsub: PubSub.PubSub<ProviderState>,
): ChatDataProviderShape => ({
  id: 'pi-rpc',
  name: 'Pi Provider',

  getState: Ref.get(stateRef).pipe(Effect.map(toProviderState)),

  getMessages: Ref.get(stateRef).pipe(Effect.map((s) => s.messages)),

  isStreaming: Ref.get(stateRef).pipe(Effect.map((s) => s.isStreaming)),

  getError: Ref.get(stateRef).pipe(
    Effect.map((s) => (s.error === null ? Option.none() : Option.some(s.error))),
  ),

  getMetrics: Ref.get(stateRef).pipe(
    Effect.map((s) => s.metrics),
  ),

  sendMessage: (options: SendMessageOptions) =>
    Effect.gen(function* () {
      const user = createUserMessage(options.text)
      const next = yield* Ref.updateAndGet(stateRef, (s) => ({
        ...s,
        messages: [...s.messages, user],
        error: null,
      }))
      yield* PubSub.publish(pubsub, toProviderState(next))

      const sessionId = yield* Ref.get(activeSessionRef)
      const clientMessageId = `client-${nanoid()}` as any

      yield* runtime.send(sessionId, clientMessageId, options.text, Option.none()).pipe(
        Effect.mapError((cause) => mapSendError('Failed to send prompt to harness runtime', cause)),
      )

      const lastSeq = yield* Ref.get(lastAppliedSeqRef)
      const snapshot = yield* runtime.getSnapshot(sessionId, Option.some(lastSeq)).pipe(
        Effect.mapError((cause) => mapSendError('Failed to sync harness snapshot after send', cause)),
      )

      if (snapshot.events.length > 0) {
        yield* Ref.set(lastAppliedSeqRef, snapshot.headSeq)
        yield* ingestRenderInputs(reducer, snapshot.events)
        const updated = yield* Ref.updateAndGet(stateRef, (s) => replaySnapshotState(s, snapshot.events))
        yield* PubSub.publish(pubsub, toProviderState(updated))
      }
    }),

  abort: Effect.gen(function* () {
    const sessionId = yield* Ref.get(activeSessionRef)

    yield* runtime.abortSession(sessionId).pipe(Effect.catchAll(() => Effect.void))

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      isStreaming: false,
      streamingMessageId: null,
    }))

    yield* publishState(stateRef, pubsub)
  }),

  clear: Effect.gen(function* () {
    const freshNodeId = `${cfg.nodeId}-clear-${nanoid(6)}`

    const session = yield* runtime.openSession(freshNodeId, cfg.role).pipe(
      Effect.mapError((cause) => mapSendError('Failed to open fresh harness session during clear', cause)),
    )

    yield* Ref.set(activeSessionRef, session.sessionId)
    yield* Ref.set(lastAppliedSeqRef, 0)
    yield* Ref.set(stateRef, initialState(session.sessionId))
    yield* publishState(stateRef, pubsub)
  }).pipe(Effect.catchAll(() => Effect.void)),

  getPendingExtensionUI: Ref.get(stateRef).pipe(
    Effect.map((s) => s.pendingExtensionUI),
  ),

  respondExtensionUI: (response: ExtensionUIResponse) =>
    Effect.gen(function* () {
      const pending = yield* Ref.get(stateRef).pipe(
        Effect.map((s) => s.pendingExtensionUI.find((entry) => entry.requestId === response.requestId)),
      )

      if (!pending) {
        return yield* Effect.fail(
          mapSendError(`No pending extension UI request found for ${response.requestId}`, response),
        )
      }

      const sessionId = yield* Ref.get(activeSessionRef)
      yield* runtime.respondExtensionUI(sessionId, toHarnessExtensionUIResponse(response)).pipe(
        Effect.mapError((cause) =>
          mapSendError(`Failed to send extension UI response for ${response.requestId}`, cause),
        ),
      )

      const next = yield* Ref.updateAndGet(stateRef, (s) => ({
        ...s,
        pendingExtensionUI: s.pendingExtensionUI.filter((entry) => entry.requestId !== response.requestId),
      }))

      yield* PubSub.publish(pubsub, toProviderState(next))
    }),

  stateChanges: Stream.fromPubSub(pubsub),
})

// =============================================================================
// Layer
// =============================================================================

const PiProviderCoreLive = Layer.scoped(
  ChatDataProvider,
  Effect.gen(function* () {
    const cfg = yield* PiProviderConfig
    const runtime = yield* HarnessRuntime
    const reducer = yield* OverlayReducerPipeline

    const session = yield* runtime.openSession(cfg.nodeId, cfg.role).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new ProviderNotConfiguredError({
            providerId: 'pi-rpc',
            reason: `Failed to open harness session: ${e.message}`,
          }),
        ),
      ),
    )

    const activeSessionRef = yield* Ref.make<HarnessSessionId>(session.sessionId)
    const lastAppliedSeqRef = yield* Ref.make(0)
    const stateRef = yield* Ref.make<PiBridgeState>(initialState(session.sessionId))
    const pubsub = yield* PubSub.unbounded<ProviderState>()

    yield* Effect.acquireRelease(
      reducer.register(PI_PROVIDER_OVERLAY),
      () => reducer.unregister(PI_PROVIDER_OVERLAY_ID).pipe(Effect.catchAll(() => Effect.void)),
    )

    yield* Effect.forkScoped(eventLoop(runtime, reducer, activeSessionRef, lastAppliedSeqRef, stateRef, pubsub))
    yield* Effect.forkScoped(reducerMetricLoop(reducer, activeSessionRef, stateRef, pubsub))

    const snapshot = yield* runtime.resumeSession(session.sessionId, Option.none()).pipe(
      Effect.catchAll(() => runtime.getSnapshot(session.sessionId, Option.none())),
      Effect.catchAll(() => Effect.succeed({ sessionId: session.sessionId, headSeq: 0 as any, events: [] } as any)),
    )

    yield* Ref.set(lastAppliedSeqRef, snapshot.headSeq)
    yield* ingestRenderInputs(reducer, snapshot.events as ReadonlyArray<HarnessEvent>)
    yield* Ref.update(stateRef, (state) => replaySnapshotState(state, snapshot.events as ReadonlyArray<HarnessEvent>))
    yield* publishState(stateRef, pubsub)

    return createPiProviderShape(cfg, runtime, reducer, activeSessionRef, lastAppliedSeqRef, stateRef, pubsub)
  }),
)

const PiProviderLive = PiProviderCoreLive.pipe(
  Layer.provide(OverlayReducerPipelineLive),
)

const PiProviderBrowserLive = PiProviderLive

const PiProviderBrowserWebSocketDefault = PiProviderLive.pipe(
  Layer.provide(HarnessRuntimeBrowserWebSocketDefault),
)

export const PiProvider = {
  Default: PiProviderLive,

  /**
   * Browser/runtime alias: callers provide HarnessRuntime implementation.
   */
  Browser: PiProviderBrowserLive,

  /**
   * Backward-compatible alias (transport managed by caller-provided HarnessRuntime layer).
   */
  BrowserWebSocketDefault: PiProviderBrowserWebSocketDefault,

  layer: (config: PiProviderConfigShape) =>
    PiProviderLive.pipe(Layer.provide(Layer.succeed(PiProviderConfig, config))),

  browserLayer: (config: PiProviderConfigShape) =>
    PiProviderBrowserLive.pipe(Layer.provide(Layer.succeed(PiProviderConfig, config))),

  browserWebSocketLayer: (
    config: PiProviderConfigShape,
    transportConfig?: HarnessBrowserTransportConfigShape,
  ) =>
    PiProviderLive.pipe(
      Layer.provide(Layer.succeed(PiProviderConfig, config)),
      Layer.provide(
        transportConfig
          ? HarnessRuntimeBrowserLive.pipe(
              Layer.provide(makeHarnessBrowserTransportLayer(transportConfig)),
            )
          : HarnessRuntimeBrowserWebSocketDefault,
      ),
    ),
}
