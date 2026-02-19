import { type Context as PiAiContext, type Message as PiAiMessage, type Model as PiAiModel, type ToolCall as PiAiToolCall, getModel as piAiGetModel } from '@mariozechner/pi-ai'
import { AuthStorage, ModelRegistry } from '@mariozechner/pi-coding-agent'
import { nanoid } from 'nanoid'
import { Context, Effect, Fiber, HashMap, HashSet, Layer, Option, PubSub, Ref, Schema, Stream } from 'effect'

import { HarnessSessionStore } from './HarnessSessionStore'
import { HarnessSessionStoreMemoryLive } from './HarnessSessionStoreMemory'
import { PiAiEventAdapter, PiAiEventAdapterLive } from './PiAiEventAdapter'
import { PiAiPolicy, PiAiPolicyLive } from './PiAiPolicy'
import { PiAiStreamClient, PiAiStreamClientLive } from './PiAiStreamClient'
import { PiAiToolRuntime, PiAiToolRuntimeError, PiAiToolRuntimeLive } from './PiAiToolRuntime'
import type { HarnessRole as AgentRole, HarnessThinkingLevel as ThinkingLevel } from './schemas'
import {
  HarnessAssistantDeltaEvent,
  HarnessAssistantThinkingDeltaEvent,
  HarnessAssistantFinalEvent,
  HarnessAssistantStartEvent,
  HarnessUsageEvent,
  HarnessMetricEvent,
  HarnessErrorEvent,
  HarnessEvent,
  HarnessSendAcceptedEvent,
  HarnessSessionOpenedEvent,
  HarnessSnapshot,
  HarnessToolEvent,
  HarnessProviderMarkerEvent,
  type HarnessClientMessageId as ChatClientMessageId,
  type HarnessMessageId as ChatMessageId,
  type HarnessSessionId as ChatSessionId,
  type HarnessExtensionUIResponse,
  HarnessEventEnvelope,
  HarnessSessionEnvelope,
} from './schemas'

export class PiAiHarnessEngineError extends Schema.TaggedError<PiAiHarnessEngineError>()(
  'PiAiHarnessEngineError',
  {
    code: Schema.String,
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

type SessionRecord = {
  readonly sessionId: ChatSessionId
  readonly nodeId: string
  readonly role: AgentRole
  readonly agentId: string
  readonly headSeq: number
  readonly createdAt: number
  readonly events: ReadonlyArray<typeof HarnessEvent.Type>
  readonly clientMessageIds: HashSet.HashSet<string>
  readonly activeAssistantMessageId: ChatMessageId | null
  readonly activeAbortController: AbortController | null
  readonly abortRequestedAtMs: number | null
  readonly model: PiAiModel<any>
  readonly context: PiAiContext
}

type SessionView = {
  readonly sessionId: ChatSessionId
  readonly nodeId: string
  readonly role: AgentRole
  readonly agentId: string
  readonly headSeq: number
}

export interface ModelOverride {
  readonly provider: string
  readonly modelId: string
}

export interface AvailableModelInfo {
  readonly id: string
  readonly name: string
  readonly provider: string
  readonly reasoning: boolean
  readonly contextWindow: number
  readonly maxTokens: number
}

export interface PiAiHarnessEngineShape {
  readonly openSession: (nodeId: string, role: AgentRole) => Effect.Effect<SessionView, PiAiHarnessEngineError>
  readonly send: (
    sessionId: ChatSessionId,
    clientMessageId: ChatClientMessageId,
    text: string,
    thinkingLevel: Option.Option<ThinkingLevel>,
    modelOverride?: ModelOverride,
  ) => Effect.Effect<{ readonly accepted: true; readonly sessionId: ChatSessionId }, PiAiHarnessEngineError>
  readonly getAvailableModels: () => Effect.Effect<ReadonlyArray<AvailableModelInfo>, PiAiHarnessEngineError>
  readonly getSnapshot: (
    sessionId: ChatSessionId,
    fromSeq: Option.Option<number>,
  ) => Effect.Effect<HarnessSnapshot, PiAiHarnessEngineError>
  readonly abortSession: (sessionId: ChatSessionId) => Effect.Effect<void, PiAiHarnessEngineError>
  readonly respondExtensionUI: (
    sessionId: ChatSessionId,
    _response: HarnessExtensionUIResponse,
  ) => Effect.Effect<void, PiAiHarnessEngineError>
  readonly events: Stream.Stream<typeof HarnessEvent.Type, PiAiHarnessEngineError>
}

export const PiAiHarnessEngine = Context.GenericTag<PiAiHarnessEngineShape>('tmnl/harness/PiAiHarnessEngine')

const toEngineError = (code: string, message: string) => (cause: unknown) =>
  new PiAiHarnessEngineError({
    code,
    message,
    cause: Option.some(cause),
  })

const extractAssistantText = (message: PiAiMessage): string => {
  if (message.role !== 'assistant') return ''

  return message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim()
}

const extractAssistantToolCalls = (message: PiAiMessage): ReadonlyArray<PiAiToolCall> => {
  if (message.role !== 'assistant') return []
  return message.content.flatMap((block) => (block.type === 'toolCall' ? [block] : []))
}

export const PiAiHarnessEngineCoreLive = Layer.effect(
  PiAiHarnessEngine,
  Effect.gen(function* () {
    const policy = yield* PiAiPolicy
    const adapter = yield* PiAiEventAdapter
    const streamClient = yield* PiAiStreamClient
    const toolRuntime = yield* PiAiToolRuntime
    const store = yield* HarnessSessionStore

    const model = yield* policy.resolveModel.pipe(
      Effect.mapError((error) =>
        new PiAiHarnessEngineError({
          code: error.code,
          message: error.message,
          cause: error.cause,
        }),
      ),
    )

    // ── ModelRegistry for available models + per-message override ──
    const authStorage = new AuthStorage()
    const modelRegistry = new ModelRegistry(authStorage)

    const sessionsRef = yield* Ref.make<HashMap.HashMap<string, SessionRecord>>(HashMap.empty())
    const nodeToSessionRef = yield* Ref.make<HashMap.HashMap<string, string>>(HashMap.empty())
    const activeRunsRef = yield* Ref.make<HashMap.HashMap<string, Fiber.RuntimeFiber<void, never>>>(HashMap.empty())
    const streamSemaphore = yield* Effect.makeSemaphore(policy.config.maxConcurrentStreams)
    const eventsPubSub = yield* PubSub.unbounded<typeof HarnessEvent.Type>()

    const persistSession = (session: SessionRecord) =>
      store.upsertSession(
        new HarnessSessionEnvelope({
          sessionId: session.sessionId,
          nodeId: session.nodeId,
          role: session.role,
          agentId: session.agentId,
          backend: 'pi-ai',
          headSeq: session.headSeq as any,
          status: 'active',
          createdAt: session.createdAt,
          updatedAt: Date.now(),
        }),
      ).pipe(Effect.catchAll(() => Effect.void))

    const appendEvent = (
      sessionId: string,
      build: (nextSeq: number, session: SessionRecord) => typeof HarnessEvent.Type,
    ) =>
      Effect.gen(function* () {
        const maybeAppended = yield* Ref.modify(sessionsRef, (current) =>
          Option.match(HashMap.get(current, sessionId), {
            onNone: () => [Option.none(), current] as const,
            onSome: (session) => {
              const nextSeq = session.headSeq + 1
              const event = build(nextSeq, session)
              const nextSession: SessionRecord = {
                ...session,
                headSeq: nextSeq,
                events: [...session.events, event],
              }

              return [Option.some({ event, session: nextSession }), HashMap.set(current, sessionId, nextSession)] as const
            },
          }),
        )

        if (Option.isNone(maybeAppended)) return

        const { event, session } = maybeAppended.value
        yield* PubSub.publish(eventsPubSub, event)

        yield* store.appendEvent(
          new HarnessEventEnvelope({
            sessionId: session.sessionId,
            seq: event.seq,
            event,
            persistedAt: Date.now(),
          }),
        ).pipe(Effect.catchAll(() => Effect.void))

        yield* persistSession(session)
      })

    const withSession = <A>(
      sessionId: string,
      f: (session: SessionRecord) => Effect.Effect<A, PiAiHarnessEngineError>,
    ) =>
      Effect.gen(function* () {
        const maybe = yield* Ref.get(sessionsRef).pipe(Effect.map((map) => HashMap.get(map, sessionId)))
        if (Option.isNone(maybe)) {
          return yield* Effect.fail(
            new PiAiHarnessEngineError({
              code: 'session-missing',
              message: `pi-ai session missing: ${sessionId}`,
              cause: Option.none(),
            }),
          )
        }

        return yield* f(maybe.value)
      })

    const runSessionPrompt = (
      sessionId: ChatSessionId,
      text: string,
      thinkingLevel: Option.Option<ThinkingLevel>,
    ) => {
      const runStartedAtMs = Date.now()
      let firstDeltaMetricEmitted = false
      const toolStartedAtMs = new Map<string, number>()

      const clearActiveState = Ref.update(sessionsRef, (current) =>
        Option.match(HashMap.get(current, sessionId), {
          onNone: () => current,
          onSome: (state) =>
            HashMap.set(current, sessionId, {
              ...state,
              activeAssistantMessageId: null,
              activeAbortController: null,
              abortRequestedAtMs: null,
            }),
        }),
      )

      return Effect.scoped(
        Effect.gen(function* () {
          const userMessage: PiAiMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now(),
          }

          const abortController = yield* Effect.acquireRelease(
            Effect.sync(() => new AbortController()),
            (controller) => Effect.sync(() => controller.abort()),
          )

          yield* Ref.update(sessionsRef, (current) =>
            Option.match(HashMap.get(current, sessionId), {
              onNone: () => current,
              onSome: (session) =>
                HashMap.set(current, sessionId, {
                  ...session,
                  context: {
                    ...session.context,
                    messages: [...session.context.messages, userMessage],
                  },
                  activeAbortController: abortController,
                  abortRequestedAtMs: null,
                }),
            }),
          )

          const runAssistantRound = (round: number): Effect.Effect<void, PiAiHarnessEngineError> =>
            Effect.gen(function* () {
              if (round >= toolRuntime.maxToolRounds) {
                yield* appendEvent(sessionId, (seq, s) =>
                  HarnessErrorEvent.make({
                    sessionId: s.sessionId,
                    seq,
                    at: Date.now(),
                    code: 'tool-round-limit-exceeded',
                    message: `Exceeded max tool rounds (${toolRuntime.maxToolRounds}) for session ${sessionId}`,
                  }),
                )
                return
              }

              const assistantMessageId = `msg-${nanoid()}` as ChatMessageId

              yield* Ref.update(sessionsRef, (current) =>
                Option.match(HashMap.get(current, sessionId), {
                  onNone: () => current,
                  onSome: (session) =>
                    HashMap.set(current, sessionId, {
                      ...session,
                      activeAssistantMessageId: assistantMessageId,
                    }),
                }),
              )

              yield* appendEvent(sessionId, (seq, session) =>
                HarnessAssistantStartEvent.make({
                  sessionId: session.sessionId,
                  seq,
                  at: Date.now(),
                  messageId: assistantMessageId,
                }),
              )

              const session = yield* withSession(sessionId, Effect.succeed)
              const streamOptions = yield* policy.makeStreamOptions({
                thinkingLevel,
                sessionId,
                signal: abortController.signal,
              })

              const stream = yield* Effect.try({
                try: () => streamClient.stream(session.model, session.context, streamOptions),
                catch: (cause) =>
                  new PiAiHarnessEngineError({
                    code: 'pi-ai-stream-init-failed',
                    message: `pi-ai stream init failed for session ${sessionId}: ${
                      cause instanceof Error ? cause.message : String(cause)
                    }`,
                    cause: Option.some(cause),
                  }),
              })

              yield* Stream.fromAsyncIterable(
                stream,
                toEngineError('pi-ai-stream-failed', `pi-ai stream failed for session ${sessionId}`),
              ).pipe(
                Stream.mapEffect((event) =>
                  Effect.gen(function* () {
                    const providerMarker = yield* adapter.toProviderMarker(event).pipe(
                      Effect.mapError((error) =>
                        new PiAiHarnessEngineError({
                          code: `provider-marker-${error.code}`,
                          message: error.message,
                          cause: error.cause,
                        }),
                      ),
                    )

                    yield* appendEvent(sessionId, (seq, s) =>
                      HarnessProviderMarkerEvent.make({
                        sessionId: s.sessionId,
                        seq,
                        at: Date.now(),
                        marker: providerMarker,
                      }),
                    )

                    const adapted = yield* adapter.adapt(event).pipe(
                      Effect.mapError((error) =>
                        new PiAiHarnessEngineError({
                          code: `adapter-${error.code}`,
                          message: error.message,
                          cause: error.cause,
                        }),
                      ),
                    )

                    if (adapted._tag === 'PiAiAdapterTextDelta') {
                        return yield* Effect.gen(function* () {
                          if (!firstDeltaMetricEmitted) {
                            firstDeltaMetricEmitted = true
                            yield* appendEvent(sessionId, (seq, s) =>
                              HarnessMetricEvent.make({
                                sessionId: s.sessionId,
                                seq,
                                at: Date.now(),
                                metric: 'firstDeltaLagMs',
                                value: Date.now() - runStartedAtMs,
                                messageId: assistantMessageId,
                              }),
                            )
                          }

                          yield* appendEvent(sessionId, (seq, s) =>
                            HarnessAssistantDeltaEvent.make({
                              sessionId: s.sessionId,
                              seq,
                              at: Date.now(),
                              messageId: assistantMessageId,
                              delta: adapted.delta,
                            }),
                          )
                        })
                      }

                      if (adapted._tag === 'PiAiAdapterThinkingDelta') {
                        return yield* Effect.gen(function* () {
                          if (!firstDeltaMetricEmitted) {
                            firstDeltaMetricEmitted = true
                            yield* appendEvent(sessionId, (seq, s) =>
                              HarnessMetricEvent.make({
                                sessionId: s.sessionId,
                                seq,
                                at: Date.now(),
                                metric: 'firstDeltaLagMs',
                                value: Date.now() - runStartedAtMs,
                                messageId: assistantMessageId,
                              }),
                            )
                          }

                          yield* appendEvent(sessionId, (seq, s) =>
                            HarnessAssistantThinkingDeltaEvent.make({
                              sessionId: s.sessionId,
                              seq,
                              at: Date.now(),
                              messageId: assistantMessageId,
                              delta: adapted.delta,
                            }),
                          )
                        })
                      }

                      if (adapted._tag === 'PiAiAdapterToolStart') {
                        return yield* Effect.gen(function* () {
                          toolStartedAtMs.set(adapted.toolCallId, Date.now())

                          yield* appendEvent(sessionId, (seq, s) =>
                            HarnessToolEvent.make({
                              sessionId: s.sessionId,
                              seq,
                              at: Date.now(),
                              toolCallId: adapted.toolCallId,
                              toolName: adapted.toolName,
                              phase: 'start',
                              payload: {
                                diagnostics: {
                                  toolNameResolved: adapted.toolNameResolved,
                                  adapter: adapted.diagnostics,
                                },
                              },
                            }),
                          )
                        })
                      }

                      if (adapted._tag === 'PiAiAdapterToolDelta') {
                        return yield* appendEvent(sessionId, (seq, s) =>
                          HarnessToolEvent.make({
                            sessionId: s.sessionId,
                            seq,
                            at: Date.now(),
                            toolCallId: adapted.toolCallId,
                            toolName: adapted.toolName,
                            phase: 'update',
                            payload: {
                              delta: adapted.delta,
                              diagnostics: {
                                toolNameResolved: adapted.toolNameResolved,
                                adapter: adapted.diagnostics,
                              },
                            },
                          }),
                        )
                      }

                      if (adapted._tag === 'PiAiAdapterToolEnd') {
                        return yield* appendEvent(sessionId, (seq, s) =>
                          HarnessToolEvent.make({
                            sessionId: s.sessionId,
                            seq,
                            at: Date.now(),
                            toolCallId: adapted.toolCallId,
                            toolName: adapted.toolName,
                            phase: 'end',
                            payload: {
                              arguments: adapted.arguments,
                              diagnostics: {
                                toolNameResolved: adapted.toolName !== 'unknown',
                                adapter: adapted.diagnostics,
                              },
                            },
                          }),
                        )
                      }

                      if (adapted.diagnostics.length > 0) {
                        return yield* appendEvent(sessionId, (seq, s) =>
                          HarnessErrorEvent.make({
                            sessionId: s.sessionId,
                            seq,
                            at: Date.now(),
                            code: 'adapter-noop-diagnostic',
                            message: adapted.diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('; '),
                          }),
                        )
                      }

                      return yield* Effect.void
                  }),
                ),
                Stream.runDrain,
                Effect.timeoutFail({
                  duration: policy.config.requestTimeoutMs,
                  onTimeout: () =>
                    new PiAiHarnessEngineError({
                      code: 'stream-timeout',
                      message: `pi-ai stream timed out after ${policy.config.requestTimeoutMs}ms (round ${round + 1})`,
                      cause: Option.none(),
                    }),
                }),
              )

              const finalMessage = yield* Effect.tryPromise({
                try: () => stream.result(),
                catch: toEngineError('pi-ai-stream-result-failed', `pi-ai stream finalization failed for session ${sessionId}`),
              }).pipe(
                Effect.timeoutFail({
                  duration: policy.config.requestTimeoutMs,
                  onTimeout: () =>
                    new PiAiHarnessEngineError({
                      code: 'stream-result-timeout',
                      message: `pi-ai stream result timed out after ${policy.config.requestTimeoutMs}ms (round ${round + 1})`,
                      cause: Option.none(),
                    }),
                }),
              )

              const finalText = extractAssistantText(finalMessage)

              yield* Ref.update(sessionsRef, (current) =>
                Option.match(HashMap.get(current, sessionId), {
                  onNone: () => current,
                  onSome: (state) =>
                    HashMap.set(current, sessionId, {
                      ...state,
                      context: {
                        ...state.context,
                        messages: [...state.context.messages, finalMessage],
                      },
                    }),
                }),
              )

              if (finalText.length > 0) {
                yield* appendEvent(sessionId, (seq, s) =>
                  HarnessAssistantFinalEvent.make({
                    sessionId: s.sessionId,
                    seq,
                    at: Date.now(),
                    messageId: assistantMessageId,
                    text: finalText,
                  }),
                )
              }

              yield* appendEvent(sessionId, (seq, s) =>
                HarnessUsageEvent.make({
                  sessionId: s.sessionId,
                  seq,
                  at: Date.now(),
                  messageId: assistantMessageId,
                  provider: finalMessage.provider,
                  model: finalMessage.model,
                  api: finalMessage.api,
                  stopReason: finalMessage.stopReason,
                  usage: {
                    input: finalMessage.usage.input,
                    output: finalMessage.usage.output,
                    cacheRead: finalMessage.usage.cacheRead,
                    cacheWrite: finalMessage.usage.cacheWrite,
                    totalTokens: finalMessage.usage.totalTokens,
                  },
                  cost: {
                    input: finalMessage.usage.cost.input,
                    output: finalMessage.usage.cost.output,
                    cacheRead: finalMessage.usage.cost.cacheRead,
                    cacheWrite: finalMessage.usage.cost.cacheWrite,
                    total: finalMessage.usage.cost.total,
                  },
                }),
              )

              if (finalMessage.stopReason === 'toolUse') {
                const toolCalls = extractAssistantToolCalls(finalMessage)

                if (toolCalls.length === 0) {
                  yield* appendEvent(sessionId, (seq, s) =>
                    HarnessErrorEvent.make({
                      sessionId: s.sessionId,
                      seq,
                      at: Date.now(),
                      code: 'tool-use-without-calls',
                      message: 'stopReason was toolUse but assistant message had no tool calls',
                    }),
                  )
                  return
                }

                const toolResults = yield* Effect.forEach(toolCalls, (toolCall) =>
                  Effect.gen(function* () {
                    const startedAt = Date.now()
                    const result = yield* toolRuntime.execute(toolCall).pipe(
                      Effect.catchTag('PiAiToolRuntimeError', (error: PiAiToolRuntimeError) =>
                        Effect.succeed({
                          role: 'toolResult' as const,
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          content: [{ type: 'text' as const, text: `Tool execution failed: ${error.message}` }],
                          isError: true,
                          timestamp: Date.now(),
                        }),
                      ),
                    )

                    const completedAt = Date.now()
                    const executionMs = completedAt - startedAt
                    const roundTripMs = completedAt - (toolStartedAtMs.get(toolCall.id) ?? startedAt)

                    yield* appendEvent(sessionId, (seq, s) =>
                      HarnessToolEvent.make({
                        sessionId: s.sessionId,
                        seq,
                        at: completedAt,
                        toolCallId: toolCall.id,
                        toolName: toolCall.name,
                        phase: 'update',
                        payload: {
                          executionMs,
                          isError: result.isError,
                        },
                      }),
                    )

                    yield* appendEvent(sessionId, (seq, s) =>
                      HarnessMetricEvent.make({
                        sessionId: s.sessionId,
                        seq,
                        at: completedAt,
                        metric: 'toolRoundTripMs',
                        value: roundTripMs,
                        messageId: assistantMessageId,
                        toolCallId: toolCall.id,
                      }),
                    )

                    return result
                  }),
                )

                yield* Ref.update(sessionsRef, (current) =>
                  Option.match(HashMap.get(current, sessionId), {
                    onNone: () => current,
                    onSome: (state) =>
                      HashMap.set(current, sessionId, {
                        ...state,
                        context: {
                          ...state.context,
                          messages: [...state.context.messages, ...toolResults],
                        },
                      }),
                  }),
                )

                yield* runAssistantRound(round + 1)
                return
              }

              if (finalMessage.stopReason === 'error' || finalMessage.stopReason === 'aborted') {
                if (finalMessage.stopReason === 'aborted') {
                  const maybeAbortRequestedAtMs = yield* Ref.get(sessionsRef).pipe(
                    Effect.map((sessions) => HashMap.get(sessions, sessionId)),
                    Effect.map((sessionState) =>
                      Option.flatMap(sessionState, (state) => Option.fromNullable(state.abortRequestedAtMs)),
                    ),
                  )

                  if (Option.isSome(maybeAbortRequestedAtMs)) {
                    yield* appendEvent(sessionId, (seq, s) =>
                      HarnessMetricEvent.make({
                        sessionId: s.sessionId,
                        seq,
                        at: Date.now(),
                        metric: 'abortToStopMs',
                        value: Date.now() - maybeAbortRequestedAtMs.value,
                        messageId: assistantMessageId,
                      }),
                    )
                  }
                }

                yield* appendEvent(sessionId, (seq, s) =>
                  HarnessErrorEvent.make({
                    sessionId: s.sessionId,
                    seq,
                    at: Date.now(),
                    code: finalMessage.stopReason === 'aborted' ? 'aborted' : 'stream-error',
                    message: finalMessage.errorMessage ?? `pi-ai stream ended with ${finalMessage.stopReason}`,
                  }),
                )
              }
            }).pipe(
              Effect.withSpan('tmnl.harness.engine.assistant-round'),
            )

          yield* runAssistantRound(0)
        }),
      ).pipe(
        Effect.catchAll((error) =>
          appendEvent(sessionId, (seq, s) =>
            HarnessErrorEvent.make({
              sessionId: s.sessionId,
              seq,
              at: Date.now(),
              code: error.code,
              message: error.message,
            }),
          ),
        ),
        Effect.ensuring(clearActiveState),
        Effect.withSpan('tmnl.harness.engine.run-session-prompt'),
      )
    }

    const openSession: PiAiHarnessEngineShape['openSession'] = (nodeId, role) =>
      Effect.gen(function* () {
        const mapped = yield* Ref.get(nodeToSessionRef).pipe(Effect.map((map) => HashMap.get(map, nodeId)))

        if (Option.isSome(mapped)) {
          return yield* withSession(mapped.value as ChatSessionId, (session) =>
            Effect.succeed({
              sessionId: session.sessionId,
              nodeId: session.nodeId,
              role: session.role,
              agentId: session.agentId,
              headSeq: session.headSeq,
            }),
          )
        }

        const sessionId = `${policy.config.sessionIdPrefix}-${nanoid()}` as ChatSessionId
        const createdAt = Date.now()

        const created: SessionRecord = {
          sessionId,
          nodeId,
          role,
          agentId: `${policy.config.agentIdPrefix}-${nanoid(8)}`,
          headSeq: 0,
          createdAt,
          events: [],
          clientMessageIds: HashSet.empty<string>(),
          activeAssistantMessageId: null,
          activeAbortController: null,
          abortRequestedAtMs: null,
          model,
          context: {
            systemPrompt: policy.config.systemPrompt,
            messages: [],
            tools: [...toolRuntime.tools],
          },
        }

        yield* Ref.update(sessionsRef, HashMap.set(sessionId, created))
        yield* Ref.update(nodeToSessionRef, HashMap.set(nodeId, sessionId))

        yield* appendEvent(sessionId, (seq, session) =>
          HarnessSessionOpenedEvent.make({
            sessionId: session.sessionId,
            seq,
            at: Date.now(),
            nodeId: session.nodeId,
            role: session.role,
            agentId: session.agentId,
          }),
        )

        return {
          sessionId,
          nodeId,
          role,
          agentId: created.agentId,
          headSeq: 1,
        }
      })

    const send: PiAiHarnessEngineShape['send'] = (sessionId, clientMessageId, text, thinkingLevel, modelOverride?) =>
      withSession(sessionId, (session) =>
        Effect.gen(function* () {
          if (HashSet.has(session.clientMessageIds, clientMessageId)) {
            return { accepted: true as const, sessionId: session.sessionId }
          }

          // ── Per-message model override ──
          if (modelOverride) {
            const overrideResolved = modelRegistry.find(modelOverride.provider, modelOverride.modelId)
            if (overrideResolved) {
              yield* Ref.update(sessionsRef, (current) =>
                Option.match(HashMap.get(current, sessionId), {
                  onNone: () => current,
                  onSome: (existing) =>
                    HashMap.set(current, sessionId, { ...existing, model: overrideResolved }),
                }),
              )
              yield* Effect.logInfo(
                `[harness] Model override for session ${sessionId}: ${modelOverride.provider}/${modelOverride.modelId}`,
              )
            } else {
              yield* Effect.logWarning(
                `[harness] Model override failed — ${modelOverride.provider}/${modelOverride.modelId} not found, using session default`,
              )
            }
          }

          const sendStartedAtMs = Date.now()
          const userMessageId = `user-${nanoid()}` as ChatMessageId

          yield* Ref.update(sessionsRef, (current) =>
            Option.match(HashMap.get(current, sessionId), {
              onNone: () => current,
              onSome: (existing) =>
                HashMap.set(current, sessionId, {
                  ...existing,
                  clientMessageIds: HashSet.add(existing.clientMessageIds, clientMessageId),
                  abortRequestedAtMs: null,
                }),
            }),
          )

          yield* appendEvent(sessionId, (seq, s) =>
            HarnessSendAcceptedEvent.make({
              sessionId: s.sessionId,
              seq,
              at: Date.now(),
              clientMessageId,
              userMessageId,
            }),
          )

          yield* appendEvent(sessionId, (seq, s) =>
            HarnessMetricEvent.make({
              sessionId: s.sessionId,
              seq,
              at: Date.now(),
              metric: 'ackLatencyMs',
              value: Date.now() - sendStartedAtMs,
              messageId: userMessageId,
            }),
          )

          yield* appendEvent(sessionId, (seq, s) =>
            HarnessMetricEvent.make({
              sessionId: s.sessionId,
              seq,
              at: Date.now(),
              metric: 'retryCount',
              value: policy.config.retryCount,
              messageId: userMessageId,
              details: {
                maxRetryDelayMs: Option.getOrUndefined(policy.config.maxRetryDelayMs),
              },
            }),
          )

          const existingRun = yield* Ref.modify(activeRunsRef, (current) => {
            const existing = HashMap.get(current, sessionId)
            return [existing, HashMap.remove(current, sessionId)] as const
          })

          if (Option.isSome(existingRun)) {
            yield* Fiber.interrupt(existingRun.value)
          }

          const runFiber = yield* Effect.forkDaemon(
            streamSemaphore.withPermits(1)(runSessionPrompt(sessionId, text, thinkingLevel)).pipe(
              Effect.ensuring(
                Ref.update(activeRunsRef, HashMap.remove(sessionId)),
              ),
            ),
          )

          yield* Ref.update(activeRunsRef, HashMap.set(sessionId, runFiber))

          return {
            accepted: true as const,
            sessionId: session.sessionId,
          }
        }),
      )

    const getSnapshot: PiAiHarnessEngineShape['getSnapshot'] = (sessionId, fromSeq) =>
      withSession(sessionId, (session) =>
        Effect.gen(function* () {
          const persistedEvents = yield* store.loadEventsAfter(session.sessionId, fromSeq as any).pipe(
            Effect.map((rows) => rows.map((entry) => entry.event)),
            Effect.catchAll(() =>
              Effect.succeed(
                Option.match(fromSeq, {
                  onNone: () => [...session.events],
                  onSome: (seq) => session.events.filter((event) => event.seq > seq),
                }),
              ),
            ),
          )

          return {
            sessionId: session.sessionId,
            headSeq: session.headSeq,
            events: persistedEvents,
          }
        }),
      )

    const abortSession: PiAiHarnessEngineShape['abortSession'] = (sessionId) =>
      withSession(sessionId, (session) =>
        Effect.gen(function* () {
          session.activeAbortController?.abort()

          const activeRun = yield* Ref.modify(activeRunsRef, (current) => {
            const existing = HashMap.get(current, sessionId)
            return [existing, HashMap.remove(current, sessionId)] as const
          })

          if (Option.isSome(activeRun)) {
            yield* Fiber.interrupt(activeRun.value)
          }

          yield* Ref.update(sessionsRef, (current) =>
            Option.match(HashMap.get(current, sessionId), {
              onNone: () => current,
              onSome: (currentSession) =>
                HashMap.set(current, sessionId, {
                  ...currentSession,
                  activeAbortController: null,
                  abortRequestedAtMs: Date.now(),
                }),
            }),
          )
        }),
      )

    const respondExtensionUI: PiAiHarnessEngineShape['respondExtensionUI'] = (_sessionId) =>
      Effect.void

    const getAvailableModels: PiAiHarnessEngineShape['getAvailableModels'] = () =>
      Effect.try({
        try: () => {
          modelRegistry.refresh()
          return modelRegistry.getAvailable().map((m) => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
            reasoning: m.reasoning,
            contextWindow: m.contextWindow,
            maxTokens: m.maxTokens,
          }))
        },
        catch: (cause) =>
          new PiAiHarnessEngineError({
            code: 'model-catalog-failed',
            message: `Failed to get available models: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause: Option.some(cause),
          }),
      }).pipe(Effect.withSpan('tmnl.harness.engine.get-available-models'))

    return PiAiHarnessEngine.of({
      openSession,
      send,
      getSnapshot,
      abortSession,
      respondExtensionUI,
      getAvailableModels,
      events: Stream.fromPubSub(eventsPubSub),
    })
  }),
)

export const PiAiHarnessEngineLive = PiAiHarnessEngineCoreLive.pipe(
  Layer.provide(HarnessSessionStoreMemoryLive),
  Layer.provide(PiAiToolRuntimeLive),
  Layer.provide(PiAiStreamClientLive),
  Layer.provide(PiAiEventAdapterLive),
  Layer.provide(PiAiPolicyLive),
)
