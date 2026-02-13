import { Context, Effect, Layer, Option, Schema } from 'effect'

import {
  HarnessProviderMarker,
  HarnessProviderMarkerDone,
  HarnessProviderMarkerError,
  HarnessProviderMarkerStart,
  HarnessProviderMarkerTextDelta,
  HarnessProviderMarkerTextEnd,
  HarnessProviderMarkerTextStart,
  HarnessProviderMarkerThinkingDelta,
  HarnessProviderMarkerThinkingEnd,
  HarnessProviderMarkerThinkingStart,
  HarnessProviderMarkerToolCallDelta,
  HarnessProviderMarkerToolCallEnd,
  HarnessProviderMarkerToolCallStart,
  HarnessProviderMarkerUnknown,
  type HarnessProviderMarker as HarnessProviderMarkerType,
} from './schemas'

export class PiAiEventAdapterDiagnostic extends Schema.Class<PiAiEventAdapterDiagnostic>('PiAiEventAdapterDiagnostic')({
  code: Schema.String,
  message: Schema.String,
  severity: Schema.Literal('info', 'warn', 'error'),
}) {}

export class PiAiEventAdapterError extends Schema.TaggedError<PiAiEventAdapterError>()('PiAiEventAdapterError', {
  code: Schema.String,
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

export const PiAiRawStreamEvent = Schema.Struct({
  type: Schema.String,
  contentIndex: Schema.optional(Schema.Number),
  delta: Schema.optional(Schema.String),
  partial: Schema.optional(Schema.Unknown),
  toolCall: Schema.optional(Schema.Unknown),
  content: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  message: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.Unknown),
})

export const PiAiAdapterTextDelta = Schema.TaggedStruct('PiAiAdapterTextDelta', {
  delta: Schema.String,
  diagnostics: Schema.Array(PiAiEventAdapterDiagnostic),
})

export const PiAiAdapterThinkingDelta = Schema.TaggedStruct('PiAiAdapterThinkingDelta', {
  delta: Schema.String,
  diagnostics: Schema.Array(PiAiEventAdapterDiagnostic),
})

export const PiAiAdapterToolStart = Schema.TaggedStruct('PiAiAdapterToolStart', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  toolNameResolved: Schema.Boolean,
  diagnostics: Schema.Array(PiAiEventAdapterDiagnostic),
})

export const PiAiAdapterToolDelta = Schema.TaggedStruct('PiAiAdapterToolDelta', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  toolNameResolved: Schema.Boolean,
  delta: Schema.String,
  diagnostics: Schema.Array(PiAiEventAdapterDiagnostic),
})

export const PiAiAdapterToolEnd = Schema.TaggedStruct('PiAiAdapterToolEnd', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  arguments: Schema.Unknown,
  diagnostics: Schema.Array(PiAiEventAdapterDiagnostic),
})

export const PiAiAdapterNoop = Schema.TaggedStruct('PiAiAdapterNoop', {
  rawType: Schema.String,
  diagnostics: Schema.Array(PiAiEventAdapterDiagnostic),
})

export const PiAiAdapterEvent = Schema.Union(
  PiAiAdapterTextDelta,
  PiAiAdapterThinkingDelta,
  PiAiAdapterToolStart,
  PiAiAdapterToolDelta,
  PiAiAdapterToolEnd,
  PiAiAdapterNoop,
)

export type PiAiAdapterEvent = typeof PiAiAdapterEvent.Type

export interface PiAiEventAdapterShape {
  readonly adapt: (event: unknown) => Effect.Effect<PiAiAdapterEvent, PiAiEventAdapterError>
  readonly toProviderMarker: (event: unknown) => Effect.Effect<HarnessProviderMarkerType, PiAiEventAdapterError>
}

export const PiAiEventAdapter = Context.GenericTag<PiAiEventAdapterShape>('tmnl/harness/PiAiEventAdapter')

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null)

const decodeRawEvent = (event: unknown): Effect.Effect<typeof PiAiRawStreamEvent.Type, PiAiEventAdapterError> =>
  Schema.decodeUnknown(PiAiRawStreamEvent)(event).pipe(
    Effect.mapError((cause) =>
      new PiAiEventAdapterError({
        code: 'invalid-raw-event',
        message: 'Failed to decode raw pi-ai stream event',
        cause: Option.some(cause),
      }),
    ),
  )

const resolvePartialToolCall = (
  partial: unknown,
  contentIndex: number | undefined,
): {
  readonly toolCallId: string
  readonly toolName: string
  readonly toolNameResolved: boolean
  readonly diagnostics: ReadonlyArray<typeof PiAiEventAdapterDiagnostic.Type>
} => {
  const diagnostics: Array<typeof PiAiEventAdapterDiagnostic.Type> = []

  const partialRecord = asRecord(partial)
  const content = Array.isArray(partialRecord?.content) ? partialRecord?.content : []
  const entry = typeof contentIndex === 'number' ? content[contentIndex] : undefined
  const toolCall = asRecord(entry)

  const toolCallId = asString(toolCall?.id) ?? 'unknown-toolcall-id'
  const toolName = asString(toolCall?.name) ?? 'unknown'
  const toolNameResolved = toolName !== 'unknown'

  if (!toolNameResolved) {
    diagnostics.push(
      new PiAiEventAdapterDiagnostic({
        code: 'tool-name-unresolved',
        message: 'tool call name unresolved from partial payload',
        severity: 'warn',
      }),
    )
  }

  return {
    toolCallId,
    toolName,
    toolNameResolved,
    diagnostics,
  }
}

const unknownMarker = (providerType: string, raw: unknown): HarnessProviderMarkerType =>
  HarnessProviderMarkerUnknown.make({
    type: 'unknown',
    providerType,
    raw,
  })

const toProviderMarker = (event: unknown): Effect.Effect<HarnessProviderMarkerType, PiAiEventAdapterError> =>
  Effect.gen(function* () {
    const rawRecord = asRecord(event)
    const rawType = asString(rawRecord?.type) ?? 'unknown'

    const contentIndex = asNumber(rawRecord?.contentIndex)
    const delta = asString(rawRecord?.delta)
    const content = asString(rawRecord?.content)
    const reason = asString(rawRecord?.reason)

    switch (rawType) {
      case 'start':
        return HarnessProviderMarkerStart.make({
          type: 'start',
          partial: rawRecord?.partial,
        })
      case 'text_start':
        return contentIndex === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerTextStart.make({
              type: 'text_start',
              contentIndex,
              partial: rawRecord?.partial,
            })
      case 'text_delta':
        return contentIndex === null || delta === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerTextDelta.make({
              type: 'text_delta',
              contentIndex,
              delta,
              partial: rawRecord?.partial,
            })
      case 'text_end':
        return contentIndex === null || content === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerTextEnd.make({
              type: 'text_end',
              contentIndex,
              content,
              partial: rawRecord?.partial,
            })
      case 'thinking_start':
        return contentIndex === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerThinkingStart.make({
              type: 'thinking_start',
              contentIndex,
              partial: rawRecord?.partial,
            })
      case 'thinking_delta':
        return contentIndex === null || delta === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerThinkingDelta.make({
              type: 'thinking_delta',
              contentIndex,
              delta,
              partial: rawRecord?.partial,
            })
      case 'thinking_end':
        return contentIndex === null || content === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerThinkingEnd.make({
              type: 'thinking_end',
              contentIndex,
              content,
              partial: rawRecord?.partial,
            })
      case 'toolcall_start':
        return contentIndex === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerToolCallStart.make({
              type: 'toolcall_start',
              contentIndex,
              partial: rawRecord?.partial,
            })
      case 'toolcall_delta':
        return contentIndex === null || delta === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerToolCallDelta.make({
              type: 'toolcall_delta',
              contentIndex,
              delta,
              partial: rawRecord?.partial,
            })
      case 'toolcall_end':
        return contentIndex === null
          ? unknownMarker(rawType, event)
          : HarnessProviderMarkerToolCallEnd.make({
              type: 'toolcall_end',
              contentIndex,
              toolCall: rawRecord?.toolCall,
              partial: rawRecord?.partial,
            })
      case 'done':
        return reason === 'stop' || reason === 'length' || reason === 'toolUse'
          ? HarnessProviderMarkerDone.make({
              type: 'done',
              reason,
              message: rawRecord?.message,
            })
          : unknownMarker(rawType, event)
      case 'error':
        return reason === 'error' || reason === 'aborted'
          ? HarnessProviderMarkerError.make({
              type: 'error',
              reason,
              error: rawRecord?.error,
            })
          : unknownMarker(rawType, event)
      default:
        return unknownMarker(rawType, event)
    }
  }).pipe(
    Effect.mapError((cause) =>
      new PiAiEventAdapterError({
        code: 'provider-marker-decode-failed',
        message: 'Failed to decode provider marker from raw pi-ai stream event',
        cause: Option.some(cause),
      }),
    ),
    Effect.withSpan('tmnl.harness.event-adapter.provider-marker'),
  )

export const PiAiEventAdapterLive = Layer.succeed(
  PiAiEventAdapter,
  PiAiEventAdapter.of({
    toProviderMarker,
    adapt: (event) =>
      Effect.gen(function* () {
        const raw = yield* decodeRawEvent(event)

        if (raw.type === 'text_delta') {
          if (typeof raw.delta !== 'string') {
            return yield* Effect.fail(
              new PiAiEventAdapterError({
                code: 'invalid-text-delta',
                message: 'text_delta event missing string delta',
                cause: Option.none(),
              }),
            )
          }

          return {
            _tag: 'PiAiAdapterTextDelta',
            delta: raw.delta,
            diagnostics: [],
          }
        }

        if (raw.type === 'thinking_delta') {
          if (typeof raw.delta !== 'string') {
            return yield* Effect.fail(
              new PiAiEventAdapterError({
                code: 'invalid-thinking-delta',
                message: 'thinking_delta event missing string delta',
                cause: Option.none(),
              }),
            )
          }

          return {
            _tag: 'PiAiAdapterThinkingDelta',
            delta: raw.delta,
            diagnostics: [],
          }
        }

        if (raw.type === 'toolcall_start') {
          const resolved = resolvePartialToolCall(raw.partial, raw.contentIndex)
          return {
            _tag: 'PiAiAdapterToolStart',
            toolCallId: resolved.toolCallId,
            toolName: resolved.toolName,
            toolNameResolved: resolved.toolNameResolved,
            diagnostics: [...resolved.diagnostics],
          }
        }

        if (raw.type === 'toolcall_delta') {
          if (typeof raw.delta !== 'string') {
            return yield* Effect.fail(
              new PiAiEventAdapterError({
                code: 'invalid-toolcall-delta',
                message: 'toolcall_delta event missing string delta',
                cause: Option.none(),
              }),
            )
          }

          const resolved = resolvePartialToolCall(raw.partial, raw.contentIndex)
          return {
            _tag: 'PiAiAdapterToolDelta',
            toolCallId: resolved.toolCallId,
            toolName: resolved.toolName,
            toolNameResolved: resolved.toolNameResolved,
            delta: raw.delta,
            diagnostics: [...resolved.diagnostics],
          }
        }

        if (raw.type === 'toolcall_end') {
          const toolCall = asRecord(raw.toolCall)
          const toolCallId = asString(toolCall?.id) ?? 'unknown-toolcall-id'
          const toolName = asString(toolCall?.name) ?? 'unknown'
          const args = toolCall?.arguments ?? {}

          const diagnostics: Array<typeof PiAiEventAdapterDiagnostic.Type> = []
          if (toolName === 'unknown') {
            diagnostics.push(
              new PiAiEventAdapterDiagnostic({
                code: 'tool-name-unresolved',
                message: 'toolcall_end name unresolved from payload',
                severity: 'warn',
              }),
            )
          }

          return {
            _tag: 'PiAiAdapterToolEnd',
            toolCallId,
            toolName,
            arguments: args,
            diagnostics,
          }
        }

        return {
          _tag: 'PiAiAdapterNoop',
          rawType: raw.type,
          diagnostics: [],
        }
      }).pipe(
        Effect.withSpan('tmnl.harness.event-adapter.adapt'),
      ),
  }),
)
