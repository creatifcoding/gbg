/**
 * CardEntity Handlers - Effect Cluster Behavior Implementation
 *
 * Implements the handlers for CardEntity RPCs using real agents:
 * - Chat: Streaming LLM responses via AICoreService
 * - UI Generation: Progressive UI patches via JSON-render streaming
 * - Chart Styling: LLM-driven chart customization via chart styler agent
 * - Morph Agents: Fix/evolve operations via morph agents
 * - Operations Control: Cancel, state query
 *
 * Architecture:
 * - AICoreService for AI streaming (ai-core)
 * - Chart Styler Agent for chart styling
 * - Fix/Evolution Agents for morph operations
 * - DurableStreams for interaction persistence
 * - Effect.withSpan for observability
 *
 * @see Clusterized Cursor Architecture
 * @module cursor/cluster/CardEntityHandlers
 */

import { Effect, Stream, Ref, HashMap, Option, pipe, Chunk } from 'effect'
import {
  CardEntity,
  CardId,
  OperationId,
  CardEntityError,
  AIProviderError,
  type CardState,
  type ChatChunk,
  type StylePatch,
  type MorphPatch,
} from './CardEntity'
import { AICoreService } from '../../ai-core/services/AICoreService'
import type { AIStreamEvent } from '../../ai-core/schemas/stream'
import {
  userMessage,
  assistantMessage,
  type Message,
} from '../../ai-core/schemas/message'
import { DurableStreamClient } from '../../durable-streams/service'
import {
  streamChartStyleAgentEffect,
  type AgentStylePatch,
  type ChartStylerAgentError,
} from '../../charts/styler/agent'
import {
  streamFixAgent,
  type FixAgentResult,
} from '../../morph-card/agents/fix-agent'
import {
  streamEvolutionAgent,
  type EvolutionAgentResult,
} from '../../morph-card/agents/evolution-agent'
import {
  FixAgentRequest,
  EvolutionAgentRequest,
  type JsonPatch,
} from '../../morph-card/schemas/patch-protocol'
import { streamText } from 'ai'
import { claudeCode } from 'ai-sdk-provider-claude-code'
import { buildUIGenerationPrompt } from '../prompts/ui-generation'
import { JsonPatch as JsonPatchSchema, decodeJsonPatchSync } from '../../json-render/core/schemas'

// =============================================================================
// Event Mapping: AIStreamEvent → ChatChunk
// =============================================================================

/**
 * Map AIStreamEvent from ai-core to ChatChunk for RPC response.
 * Filters out lifecycle events and maps content/tool events.
 */
const mapAIEventToChatChunk = (event: AIStreamEvent): ChatChunk | null => {
  switch (event._tag) {
    case 'TextDelta':
      return { _tag: 'TextDelta', text: event.text }

    case 'ToolCallComplete':
      return {
        _tag: 'ToolCall',
        toolCallId: event.toolCallId,
        name: event.toolName,
        args: event.args,
      }

    case 'ToolResult':
      return {
        _tag: 'ToolResult',
        toolCallId: event.toolCallId,
        name: event.toolName,
        result: event.result,
      }

    case 'StreamComplete': {
      // Map finish reasons to ChatChunk's supported set
      const finishReason =
        event.finishReason === 'unknown' || event.finishReason === 'aborted'
          ? 'stop'
          : event.finishReason
      return {
        _tag: 'Done',
        finishReason,
        usage: event.usage
          ? {
              promptTokens: event.usage.promptTokens,
              completionTokens: event.usage.completionTokens,
            }
          : undefined,
      }
    }

    // Skip non-content events
    case 'StreamStart':
    case 'ThinkingDelta':
    case 'ToolCallStart':
    case 'ToolCallDelta':
    case 'StreamError':
      return null

    default:
      return null
  }
}

// =============================================================================
// History Conversion: CardEntity ChatMessage → ai-core Message
// =============================================================================

/**
 * Convert CardEntity history to ai-core Message format
 */
const convertHistoryToMessages = (
  history: readonly { role: string; content: string }[]
): readonly Message[] =>
  history.map((m) => {
    if (m.role === 'user') return userMessage(m.content)
    if (m.role === 'assistant') return assistantMessage(m.content)
    // System messages not directly supported in history, treat as user
    return userMessage(m.content)
  })

// =============================================================================
// In-Memory State
// =============================================================================

/**
 * Track active operations per card for cancellation support
 */
interface CardOperationState {
  readonly activeOperations: Set<string>
  readonly abortControllers: Map<string, () => Effect.Effect<void>>
  readonly lastActivity: Date
}

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * CardEntity Handlers
 *
 * Real implementation using ai-core for AI streaming.
 * Uses envelope.payload pattern for accessing request data.
 */
export const CardEntityHandlers = CardEntity.toLayer(
  Effect.gen(function* () {
    // Yield AICoreService for AI streaming
    const aiCore = yield* AICoreService

    // Optional DurableStreamClient for persistence (graceful degradation)
    const durableStreamOption = yield* Effect.serviceOption(DurableStreamClient)

    // In-memory state for card operations
    const cardStates = yield* Ref.make(HashMap.empty<string, CardOperationState>())

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Register an operation with optional abort controller
    // ─────────────────────────────────────────────────────────────────────────
    const registerOperation = (
      cardId: string,
      operationId: string,
      abortFn?: () => Effect.Effect<void>
    ) =>
      Ref.update(cardStates, (states) => {
        const existing = HashMap.get(states, cardId)
        const current =
          existing._tag === 'Some'
            ? existing.value
            : {
                activeOperations: new Set<string>(),
                abortControllers: new Map<string, () => Effect.Effect<void>>(),
                lastActivity: new Date(),
              }

        const newOps = new Set(current.activeOperations)
        newOps.add(operationId)

        const newAborts = new Map(current.abortControllers)
        if (abortFn) {
          newAborts.set(operationId, abortFn)
        }

        return HashMap.set(states, cardId, {
          activeOperations: newOps,
          abortControllers: newAborts,
          lastActivity: new Date(),
        })
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Unregister an operation when complete
    // ─────────────────────────────────────────────────────────────────────────
    const unregisterOperation = (cardId: string, operationId: string) =>
      Ref.update(cardStates, (states) => {
        const existing = HashMap.get(states, cardId)
        if (existing._tag === 'None') return states

        const current = existing.value
        const newOps = new Set(current.activeOperations)
        newOps.delete(operationId)

        const newAborts = new Map(current.abortControllers)
        newAborts.delete(operationId)

        return HashMap.set(states, cardId, {
          activeOperations: newOps,
          abortControllers: newAborts,
          lastActivity: new Date(),
        })
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Get abort function for an operation
    // ─────────────────────────────────────────────────────────────────────────
    const getAbortFn = (cardId: string, operationId: string) =>
      Effect.gen(function* () {
        const states = yield* Ref.get(cardStates)
        const existing = HashMap.get(states, cardId)
        if (existing._tag === 'None') return Option.none<() => Effect.Effect<void>>()
        return Option.fromNullable(existing.value.abortControllers.get(operationId))
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Persist interaction to DurableStreams (if available)
    // ─────────────────────────────────────────────────────────────────────────
    const persistInteraction = (
      cardId: string,
      operationId: string,
      eventType: string,
      data: unknown
    ) =>
      pipe(
        durableStreamOption,
        Option.match({
          onNone: () => Effect.void,
          onSome: (client) =>
            pipe(
              client.getOrCreate({ url: `card/${cardId}/interactions` }),
              Effect.flatMap((handle) =>
                handle.append({
                  operationId,
                  eventType,
                  data,
                  timestamp: new Date().toISOString(),
                })
              ),
              Effect.catchAll((e) =>
                Effect.logWarning(`Failed to persist interaction: ${e}`)
              )
            ),
        })
      )

    return {
      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 1: Chat (Streaming) - REAL IMPLEMENTATION
      // ─────────────────────────────────────────────────────────────────────────

      StreamChat: (envelope) => {
        const { cardId, operationId, prompt, mode, history } = envelope.payload

        return Stream.unwrap(
          Effect.gen(function* () {
            yield* Effect.logInfo(`StreamChat: card=${cardId} op=${operationId}`)

            // Convert history to ai-core Message format and add current prompt
            const historyMessages = convertHistoryToMessages(history)
            const messages = [...historyMessages, userMessage(prompt)]

            // Create stream handle from AICoreService
            const handle = yield* aiCore.streamChat({
              messages,
              mode: mode ?? 'cursor',
            })

            // Register operation with abort controller
            yield* registerOperation(cardId, operationId, handle.abort)

            // Persist start event
            yield* persistInteraction(cardId, operationId, 'chat_start', {
              prompt,
              mode,
            })

            // Map AIStreamEvent → ChatChunk, filtering nulls
            // Map AICoreStreamError → AIProviderError for RPC compatibility
            return pipe(
              handle.stream,
              Stream.map(mapAIEventToChatChunk),
              Stream.filter((chunk): chunk is ChatChunk => chunk !== null),
              Stream.mapError((err) =>
                new AIProviderError({
                  provider: 'ai-core',
                  message: err.message,
                  retryable: err.phase === 'read' || err.phase === 'connect',
                })
              )
            )
          }).pipe(
            Effect.withSpan('CardEntity.StreamChat', {
              attributes: { cardId, operationId },
            }),
            Effect.catchAll((error) =>
              Effect.succeed(
                Stream.make({
                  _tag: 'Done' as const,
                  finishReason: 'error' as const,
                  usage: undefined,
                })
              )
            )
          )
        ).pipe(
          Stream.ensuring(
            Effect.all([
              unregisterOperation(cardId, operationId),
              persistInteraction(cardId, operationId, 'chat_end', {}),
            ])
          )
        )
      },

      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 2: UI Generation (Streaming) - REAL IMPLEMENTATION
      // ─────────────────────────────────────────────────────────────────────────

      StreamUIGenerate: (envelope) => {
        const { cardId, operationId, prompt, catalog, context } = envelope.payload

        /**
         * Parse a JSON patch line from NDJSON stream
         */
        const parseNDJSONLine = (line: string): JsonPatchSchema | null => {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('//')) return null

          try {
            const raw = JSON.parse(trimmed)
            // Use Schema.decodeSync for validation
            return decodeJsonPatchSync(raw)
          } catch {
            return null
          }
        }

        /**
         * Create an async iterable from AI SDK streamText result
         */
        async function* streamUIPatches(): AsyncGenerator<JsonPatchSchema> {
          const contextMessage = context
            ? `Context:\n${JSON.stringify(context, null, 2)}\n\nModify or extend based on:`
            : ''
          const result = streamText({
            model: claudeCode('sonnet'),
            system: buildUIGenerationPrompt(),
            prompt: contextMessage ? `${contextMessage}\n\n${prompt}` : prompt,
          })

          let buffer = ''

          // Stream text chunks and parse NDJSON lines
          for await (const chunk of result.textStream) {
            buffer += chunk

            // Process complete lines
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? '' // Keep incomplete line

            for (const line of lines) {
              const jsonPatch = parseNDJSONLine(line)
              if (jsonPatch) {
                yield jsonPatch
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const jsonPatch = parseNDJSONLine(buffer)
            if (jsonPatch) {
              yield jsonPatch
            }
          }
        }

        return Stream.unwrap(
          Effect.gen(function* () {
            yield* Effect.logInfo(`StreamUIGenerate: card=${cardId} op=${operationId} catalog=${catalog ?? 'default'}`)
            yield* registerOperation(cardId, operationId)
            yield* persistInteraction(cardId, operationId, 'ui_generate_start', {
              prompt: prompt.slice(0, 200),
              catalog,
            })

            // Bridge async generator to Effect Stream
            const patchStream = Stream.fromAsyncIterable(
              streamUIPatches(),
              (e) => new Error(`UI generation error: ${String(e)}`)
            )

            // On error, emit empty stream (stream ends without patches)
            return pipe(
              patchStream,
              Stream.catchAll((_error) => Stream.empty)
            )
          }).pipe(
            Effect.withSpan('CardEntity.StreamUIGenerate', {
              attributes: { cardId, operationId, catalog: catalog ?? 'default' },
            })
          )
        ).pipe(
          Stream.ensuring(
            Effect.all([
              unregisterOperation(cardId, operationId),
              persistInteraction(cardId, operationId, 'ui_generate_end', {}),
            ])
          )
        )
      },

      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 3: Chart Styling (Streaming) - REAL IMPLEMENTATION
      // ─────────────────────────────────────────────────────────────────────────

      StreamChartStyle: (envelope) => {
        const { cardId, operationId, chartSpec, theme, instruction } = envelope.payload

        /**
         * Map AgentStylePatch → StylePatch for RPC response
         */
        const mapAgentPatchToStylePatch = (
          patch: AgentStylePatch,
          patchCount: { current: number }
        ): StylePatch[] => {
          const patches: StylePatch[] = []
          patchCount.current++

          // Map palette → ColorUpdate
          if (patch.palette && patch.palette.length > 0) {
            patches.push({
              _tag: 'ColorUpdate',
              target: 'series',
              colors: patch.palette,
            })
          }

          // Map typography → OptionUpdate
          if (patch.typography) {
            patches.push({
              _tag: 'OptionUpdate',
              path: '/typography',
              value: patch.typography,
            })
          }

          // Map animations → OptionUpdate
          if (patch.animations) {
            patches.push({
              _tag: 'OptionUpdate',
              path: '/animation',
              value: patch.animations,
            })
          }

          // Map theme intent → ThemeApply on complete
          if (patch.type === 'complete') {
            patches.push({
              _tag: 'ThemeApply',
              theme: theme ?? 'auto',
              overrides: { rationale: patch.rationale },
            })
            patches.push({
              _tag: 'Done',
              totalPatches: patchCount.current,
            })
          }

          return patches
        }

        return Stream.unwrap(
          Effect.gen(function* () {
            yield* Effect.logInfo(`StreamChartStyle: card=${cardId} op=${operationId}`)
            yield* registerOperation(cardId, operationId)
            yield* persistInteraction(cardId, operationId, 'chart_style_start', {
              theme,
              instruction,
            })

            // Extract chart type from chartSpec
            const chartType =
              typeof chartSpec === 'object' && chartSpec !== null
                ? (chartSpec as { type?: string }).type ?? 'Line'
                : 'Line'

            // Patch counter for Done event
            const patchCount = { current: 0 }

            // Create the chart style agent stream
            const agentStream = streamChartStyleAgentEffect({
              chartId: cardId,
              prompt: instruction ?? `Style this ${chartType} chart with ${theme ?? 'auto'} theme`,
              chartType,
              intent: theme,
            })

            // Map agent patches to RPC StylePatches
            return pipe(
              agentStream,
              Stream.flatMap((agentPatch) =>
                Stream.fromIterable(mapAgentPatchToStylePatch(agentPatch, patchCount))
              ),
              // Map agent errors to graceful completion
              Stream.catchAll((_error: ChartStylerAgentError) =>
                Stream.fromIterable<StylePatch>([
                  { _tag: 'Done', totalPatches: patchCount.current },
                ])
              )
            )
          }).pipe(
            Effect.withSpan('CardEntity.StreamChartStyle', {
              attributes: { cardId, operationId },
            })
          )
        ).pipe(
          Stream.ensuring(
            Effect.all([
              unregisterOperation(cardId, operationId),
              persistInteraction(cardId, operationId, 'chart_style_end', {}),
            ])
          )
        )
      },

      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 4: Morph Fix (Streaming) - REAL IMPLEMENTATION
      // ─────────────────────────────────────────────────────────────────────────

      StreamMorphFix: (envelope) => {
        const { cardId, operationId, error, component } = envelope.payload

        /**
         * Create emit callback for durable stream persistence
         */
        const emitPatch = async (
          patches: JsonPatch[],
          description?: string
        ): Promise<{ success: boolean; seq?: number }> => {
          // Persist via DurableStreams if available
          const optClient = Effect.runSync(Effect.serviceOption(DurableStreamClient))
          if (Option.isNone(optClient)) {
            return { success: true } // Graceful degradation
          }
          try {
            const handle = await Effect.runPromise(
              optClient.value.getOrCreate({ url: `card/${cardId}/patches` })
            )
            await Effect.runPromise(
              handle.append({ patches, description, timestamp: Date.now() })
            )
            return { success: true }
          } catch {
            return { success: true } // Allow client-side application
          }
        }

        return Stream.unwrap(
          Effect.gen(function* () {
            yield* Effect.logInfo(`StreamMorphFix: card=${cardId} op=${operationId}`)
            yield* registerOperation(cardId, operationId)
            yield* persistInteraction(cardId, operationId, 'morph_fix_start', {
              errorMessage: error.message,
              errorPath: error.path,
            })

            // Create async iterable from fix agent generator
            const fixRequest = new FixAgentRequest({
              cardId,
              currentTree: component as Record<string, unknown>,
              errorPath: error.path ?? '/unknown',
              errorMessage: error.message,
              originalPrompt: `Fix decode error: ${error.message}`,
            })
            const generator = streamFixAgent(fixRequest, emitPatch)

            // Bridge async generator to Effect Stream
            const agentStream = Stream.fromAsyncIterable(
              generator,
              (e) => new Error(`Fix agent error: ${String(e)}`)
            )

            // Map fix agent events to MorphPatch
            let stepNumber = 0
            let collectedPatches: JsonPatch[] = []

            return pipe(
              agentStream,
              Stream.flatMap((event) => {
                const patches: MorphPatch[] = []

                switch (event.type) {
                  case 'tool-call':
                    stepNumber++
                    patches.push({
                      _tag: 'EvolveStep',
                      stepNumber,
                      description: `Calling tool: ${event.toolName}`,
                      patch: event.input,
                    })
                    break

                  case 'tool-result':
                    if (event.toolName === 'emit_fix_patch') {
                      const result = event.output as { success: boolean; patches?: JsonPatch[] }
                      if (result.patches) {
                        collectedPatches = [...collectedPatches, ...result.patches]
                        // Emit FixApplied for each patch
                        for (const patch of result.patches) {
                          patches.push({
                            _tag: 'FixApplied',
                            path: patch.path,
                            originalValue: error.received,
                            fixedValue: patch.value,
                            reason: `Fix applied via ${event.toolName}`,
                          })
                        }
                      }
                    }
                    break

                  case 'complete':
                    const result = event.result as FixAgentResult
                    patches.push({
                      _tag: 'ValidationResult',
                      valid: result.success,
                      errors: result.error ? [result.error] : undefined,
                    })
                    patches.push({
                      _tag: 'Done',
                      success: result.success,
                      totalChanges: result.patches.length,
                    })
                    break
                }

                return Stream.fromIterable(patches)
              }),
              Stream.catchAll((_error) =>
                Stream.fromIterable<MorphPatch>([
                  { _tag: 'ValidationResult', valid: false, errors: [String(_error)] },
                  { _tag: 'Done', success: false, totalChanges: 0 },
                ])
              )
            )
          }).pipe(
            Effect.withSpan('CardEntity.StreamMorphFix', {
              attributes: { cardId, operationId },
            })
          )
        ).pipe(
          Stream.ensuring(
            Effect.all([
              unregisterOperation(cardId, operationId),
              persistInteraction(cardId, operationId, 'morph_fix_end', {}),
            ])
          )
        )
      },

      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 4: Morph Evolve (Streaming) - REAL IMPLEMENTATION
      // ─────────────────────────────────────────────────────────────────────────

      StreamMorphEvolve: (envelope) => {
        const { cardId, operationId, instruction, currentUI } = envelope.payload

        /**
         * Create emit callback for durable stream persistence
         */
        const emitPatch = async (
          patches: JsonPatch[],
          description: string
        ): Promise<{ success: boolean; seq?: number }> => {
          const optClient = Effect.runSync(Effect.serviceOption(DurableStreamClient))
          if (Option.isNone(optClient)) {
            return { success: true }
          }
          try {
            const handle = await Effect.runPromise(
              optClient.value.getOrCreate({ url: `card/${cardId}/patches` })
            )
            await Effect.runPromise(
              handle.append({ patches, description, timestamp: Date.now() })
            )
            return { success: true }
          } catch {
            return { success: true }
          }
        }

        /**
         * Stub regenerateSubtree - would connect to UI generation endpoint
         * TODO: Integrate with StreamUIGenerate or json-render agent
         */
        const regenerateSubtree = async (_prompt: string): Promise<{
          root: string
          elements: Record<string, unknown>
        }> => {
          // Stub implementation - real impl would call UI generation
          return {
            root: 'regenerated-root',
            elements: { 'regenerated-root': { type: 'Container', children: [] } },
          }
        }

        return Stream.unwrap(
          Effect.gen(function* () {
            yield* Effect.logInfo(`StreamMorphEvolve: card=${cardId} op=${operationId}`)
            yield* registerOperation(cardId, operationId)
            yield* persistInteraction(cardId, operationId, 'morph_evolve_start', {
              instruction,
            })

            // Create EvolutionAgentRequest
            const evolveRequest = new EvolutionAgentRequest({
              cardId,
              userId: operationId, // Use operationId as userId for now
              userMessage: instruction,
              currentTree: currentUI as Record<string, unknown>,
            })

            // Create async iterable from evolution agent generator
            const generator = streamEvolutionAgent(
              evolveRequest,
              emitPatch,
              regenerateSubtree
            )

            // Bridge async generator to Effect Stream
            const agentStream = Stream.fromAsyncIterable(
              generator,
              (e) => new Error(`Evolution agent error: ${String(e)}`)
            )

            // Map evolution agent events to MorphPatch
            let stepNumber = 0

            return pipe(
              agentStream,
              Stream.flatMap((event) => {
                const patches: MorphPatch[] = []

                switch (event.type) {
                  case 'tool-call':
                    stepNumber++
                    patches.push({
                      _tag: 'EvolveStep',
                      stepNumber,
                      description: `Calling tool: ${event.toolName}`,
                      patch: event.input,
                    })
                    break

                  case 'tool-result':
                    // Emit step for tool results
                    if (event.toolName === 'emit_patch') {
                      const result = event.output as { success: boolean }
                      patches.push({
                        _tag: 'ValidationResult',
                        valid: result.success,
                      })
                    }
                    break

                  case 'semantic-map':
                    // Emit step for semantic map discovery
                    stepNumber++
                    patches.push({
                      _tag: 'EvolveStep',
                      stepNumber,
                      description: 'Discovered semantic regions',
                      patch: event.map,
                    })
                    break

                  case 'complete':
                    const result = event.result as EvolutionAgentResult
                    patches.push({
                      _tag: 'ValidationResult',
                      valid: result.success,
                      errors: result.error ? [result.error] : undefined,
                    })
                    patches.push({
                      _tag: 'Done',
                      success: result.success,
                      totalChanges: result.patches.length,
                    })
                    break
                }

                return Stream.fromIterable(patches)
              }),
              Stream.catchAll((_error) =>
                Stream.fromIterable<MorphPatch>([
                  { _tag: 'ValidationResult', valid: false, errors: [String(_error)] },
                  { _tag: 'Done', success: false, totalChanges: 0 },
                ])
              )
            )
          }).pipe(
            Effect.withSpan('CardEntity.StreamMorphEvolve', {
              attributes: { cardId, operationId },
            })
          )
        ).pipe(
          Stream.ensuring(
            Effect.all([
              unregisterOperation(cardId, operationId),
              persistInteraction(cardId, operationId, 'morph_evolve_end', {}),
            ])
          )
        )
      },

      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 5: Cancel Operation - REAL IMPLEMENTATION
      // ─────────────────────────────────────────────────────────────────────────

      CancelOperation: (envelope) =>
        Effect.gen(function* () {
          const { cardId, operationId, reason } = envelope.payload
          yield* Effect.logInfo(
            `CancelOperation: card=${cardId} op=${operationId} reason=${reason ?? 'none'}`
          )

          // Get and invoke abort function if available
          const abortFnOption = yield* getAbortFn(cardId, operationId)
          yield* pipe(
            abortFnOption,
            Option.match({
              onNone: () => Effect.void,
              onSome: (abortFn) => abortFn(),
            })
          )

          yield* unregisterOperation(cardId, operationId)
          yield* persistInteraction(cardId, operationId, 'cancelled', { reason })
        }).pipe(
          Effect.withSpan('CardEntity.CancelOperation', {
            attributes: {
              cardId: envelope.payload.cardId,
              operationId: envelope.payload.operationId,
            },
          })
        ),

      // ─────────────────────────────────────────────────────────────────────────
      // RPC Group 5: Get Card State
      // ─────────────────────────────────────────────────────────────────────────

      GetCardState: (envelope) =>
        Effect.gen(function* () {
          const { cardId } = envelope.payload
          const states = yield* Ref.get(cardStates)
          const existing = HashMap.get(states, cardId)

          if (existing._tag === 'None') {
            return {
              cardId: cardId as CardId,
              activeOperations: [] as OperationId[],
              lastActivity: new Date(),
            } satisfies CardState
          }

          return {
            cardId: cardId as CardId,
            activeOperations: Array.from(existing.value.activeOperations) as OperationId[],
            lastActivity: existing.value.lastActivity,
          } satisfies CardState
        }).pipe(
          Effect.withSpan('CardEntity.GetCardState', {
            attributes: { cardId: envelope.payload.cardId },
          })
        ),
    }
  }),
  {
    // Entity idle timeout - shutdown after 5 minutes of inactivity
    maxIdleTime: '5 minutes',
  }
)

/**
 * CardEntity layer export for composition
 */
export const CardEntityLayer = CardEntityHandlers
