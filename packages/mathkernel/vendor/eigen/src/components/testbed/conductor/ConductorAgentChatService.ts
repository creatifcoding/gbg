import { Context, Data, Effect, Layer, Match, Schema } from 'effect'

import type {
  AgentRole as ConductorRole,
  InlineHarnessTaskEvent,
  InlineTaskStatus,
} from '@/lib/conductor/schemas'
import type { HarnessEvent, HarnessRole } from '@/lib/harness'

export const ConductorChatRole = Schema.Literal('user', 'assistant', 'system')
export type ConductorChatRole = typeof ConductorChatRole.Type

export class ConductorChatMessageEntity extends Schema.Class<ConductorChatMessageEntity>('ConductorChatMessage')({
  id: Schema.String,
  role: ConductorChatRole,
  text: Schema.String,
  at: Schema.String,
}) {}

export type ConductorChatMessage = typeof ConductorChatMessageEntity.Type

const ConductorAgentRole = Schema.Literal(
  'scout',
  'analyzer',
  'planner',
  'implementer',
  'reviewer',
  'conductor',
)

const ConductorThinkingLevel = Schema.Literal('none', 'low', 'med', 'high')

type ConductorThinkingLevel = typeof ConductorThinkingLevel.Type

export class ConductorAgentPromptInput extends Schema.Class<ConductorAgentPromptInput>('ConductorAgentPromptInput')({
  nodeId: Schema.String,
  role: ConductorAgentRole,
  prompt: Schema.String,
  thinkingLevel: Schema.optionalWith(ConductorThinkingLevel, { default: () => 'med' }),
}) {}

export class ConductorAgentProvisionInput extends Schema.Class<ConductorAgentProvisionInput>('ConductorAgentProvisionInput')({
  nodeId: Schema.String,
  role: ConductorAgentRole,
}) {}

export class ConductorAgentPromptResult extends Schema.Class<ConductorAgentPromptResult>('ConductorAgentPromptResult')({
  agentId: Schema.String,
  assistantText: Schema.String,
  messages: Schema.Array(Schema.Unknown),
}) {}

export class ConductorAgentProvisionResult extends Schema.Class<ConductorAgentProvisionResult>('ConductorAgentProvisionResult')({
  agentId: Schema.String,
}) {}

export class ConductorAgentChatGatewayError extends Data.TaggedError('ConductorAgentChatGatewayError')<{
  readonly reason: 'AcquireFailed' | 'PromptFailed' | 'ReadFailed' | 'DecodeFailed'
  readonly message: string
  readonly cause?: unknown
}> {}

const ROLE_TO_PI_ROLE: Record<ConductorRole, HarnessRole> = {
  scout: 'navigator',
  analyzer: 'scada-analyst',
  planner: 'general',
  implementer: 'code-assistant',
  reviewer: 'inspector',
  conductor: 'general',
}

export const conductorRoleToPiRole = (role: ConductorRole): HarnessRole => ROLE_TO_PI_ROLE[role]

export function chatMessageOf(params: {
  id?: string
  role: ConductorChatRole
  text: string
  at?: string
}): ConductorChatMessage {
  return new ConductorChatMessageEntity({
    id: params.id ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: params.role,
    text: params.text,
    at: params.at ?? new Date().toISOString(),
  })
}

export function extractAssistantText(messages: readonly unknown[]): string {
  const lastAssistant = [...messages].reverse().find((entry) => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { role?: unknown }).role === 'assistant'
    )
  })

  if (!lastAssistant || typeof lastAssistant !== 'object') {
    return ''
  }

  const content = (lastAssistant as { content?: unknown }).content
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((part) => {
      if (typeof part !== 'object' || part === null) return ''
      const record = part as { type?: unknown; text?: unknown }
      return record.type === 'text' && typeof record.text === 'string' ? record.text : ''
    })
    .join('')
    .trim()
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const deriveInlineTaskMessage = (payload: unknown): string | undefined => {
  const record = asRecord(payload)
  if (!record) return undefined

  const message =
    asString(record.message) ??
    asString(record.delta) ??
    asString(record.error) ??
    asString(record.result)

  if (message) {
    return message
  }

  if (record.result !== undefined) {
    return JSON.stringify(record.result)
  }

  return undefined
}

const deriveInlineTaskStatusOnToolEnd = (payload: unknown): InlineTaskStatus => {
  const record = asRecord(payload)
  if (!record) return 'completed'

  const explicitStatus = asString(record.status)
  if (explicitStatus === 'failed') return 'failed'
  if (explicitStatus === 'cancelled') return 'cancelled'
  if (explicitStatus === 'blocked') return 'blocked'

  if (record.error !== undefined) return 'failed'

  return 'completed'
}

export const conductorInlineTaskThreadId = (nodeId: string): string => `node:${nodeId}`

export interface ConductorInlineTaskEventAdapterInput {
  readonly nodeId: string
  readonly event: HarnessEvent
  readonly messageAnchorId?: string | null
}

export interface ConductorInlineTaskEventAdapterShape {
  readonly fromHarnessEvent: (
    input: ConductorInlineTaskEventAdapterInput,
  ) => ReadonlyArray<InlineHarnessTaskEvent>
}

export class ConductorInlineTaskEventAdapter extends Context.Tag(
  'tmnl/conductor/ConductorInlineTaskEventAdapter',
)<ConductorInlineTaskEventAdapter, ConductorInlineTaskEventAdapterShape>() {}

export const mapHarnessEventToInlineTaskEvents = ({
  nodeId,
  event,
  messageAnchorId,
}: ConductorInlineTaskEventAdapterInput): ReadonlyArray<InlineHarnessTaskEvent> => {
  if (event._tag !== 'chat:v2/tool_event') {
    return []
  }

  const payload = asRecord(event.payload)
  const progress = asNumber(payload?.progress)
  const derivedMessageAnchorId = messageAnchorId?.trim() || asString(payload?.messageId) || undefined
  const message = deriveInlineTaskMessage(payload)
  const at = new Date(event.at).toISOString()
  const threadId = conductorInlineTaskThreadId(nodeId)

  if (event.phase === 'start') {
    return [
      {
        _tag: 'InlineHarnessTaskUpserted',
        threadId,
        messageAnchorId: derivedMessageAnchorId,
        taskId: event.toolCallId,
        title: event.toolName,
        status: 'running',
        progress,
        seq: event.seq,
        at,
        message,
      },
    ]
  }

  if (event.phase === 'update') {
    if (progress !== null) {
      return [
        {
          _tag: 'InlineHarnessTaskProgressChanged',
          threadId,
          messageAnchorId: derivedMessageAnchorId,
          taskId: event.toolCallId,
          title: event.toolName,
          status: 'running',
          progress,
          seq: event.seq,
          at,
          message,
        },
      ]
    }

    return [
      {
        _tag: 'InlineHarnessTaskLogAppended',
        threadId,
        messageAnchorId: derivedMessageAnchorId,
        taskId: event.toolCallId,
        title: event.toolName,
        status: 'running',
        progress: null,
        seq: event.seq,
        at,
        message,
      },
    ]
  }

  const terminalStatus = deriveInlineTaskStatusOnToolEnd(payload)
  if (terminalStatus === 'failed') {
    return [
      {
        _tag: 'InlineHarnessTaskFailed',
        threadId,
        messageAnchorId: derivedMessageAnchorId,
        taskId: event.toolCallId,
        title: event.toolName,
        status: 'failed',
        progress,
        seq: event.seq,
        at,
        message,
      },
    ]
  }

  return [
    {
      _tag: 'InlineHarnessTaskCompleted',
      threadId,
      messageAnchorId: derivedMessageAnchorId,
      taskId: event.toolCallId,
      title: event.toolName,
      status: 'completed',
      progress: progress ?? 100,
      seq: event.seq,
      at,
      message,
    },
  ]
}

export const ConductorInlineTaskEventAdapterLive = Layer.succeed(
  ConductorInlineTaskEventAdapter,
  ConductorInlineTaskEventAdapter.of({
    fromHarnessEvent: mapHarnessEventToInlineTaskEvents,
  }),
)

const toPiThinkingLevel = (thinkingLevel: ConductorThinkingLevel): 'off' | 'low' | 'medium' | 'high' =>
  Match.value(thinkingLevel).pipe(
    Match.when('none', () => 'off' as const),
    Match.when('low', () => 'low' as const),
    Match.when('med', () => 'medium' as const),
    Match.when('high', () => 'high' as const),
    Match.exhaustive,
  )

export interface ConductorAgentChatGatewayShape {
  readonly provisionNode: (
    input: ConductorAgentProvisionInput,
  ) => Effect.Effect<ConductorAgentProvisionResult, ConductorAgentChatGatewayError>

  readonly runPrompt: (
    input: ConductorAgentPromptInput,
  ) => Effect.Effect<ConductorAgentPromptResult, ConductorAgentChatGatewayError>
}

export class ConductorAgentChatGateway extends Context.Tag('tmnl/conductor/ConductorAgentChatGateway')<
  ConductorAgentChatGateway,
  ConductorAgentChatGatewayShape
>() {}

const acquireForNode = (
  nodeId: string,
  role: ConductorRole,
): Effect.Effect<{ readonly id: string }, ConductorAgentChatGatewayError> =>
  Effect.fail(
    new ConductorAgentChatGatewayError({
      reason: 'AcquireFailed',
      message: `Legacy provision path retired for ${nodeId}/${role}. Use chat-v2 open_session on pi-ai runtime.`,
    }),
  )

export const ConductorAgentChatGatewayLive = Layer.succeed(
  ConductorAgentChatGateway,
  ConductorAgentChatGateway.of({
    provisionNode: (input) =>
      Effect.gen(function* () {
        const handle = yield* acquireForNode(input.nodeId, input.role)

        return new ConductorAgentProvisionResult({
          agentId: handle.id,
        })
      }).pipe(
        Effect.catchTags({
          ConductorAgentChatGatewayError: Effect.fail,
        }),
      ),

    runPrompt: (_input) =>
      Effect.fail(
        new ConductorAgentChatGatewayError({
          reason: 'PromptFailed',
          message: 'Legacy runPrompt pathway is retired. Use chat-v2 stream operations via agent-chat-stx.',
        }),
      ),
  }),
)

export const explainGatewayError = (error: ConductorAgentChatGatewayError): string =>
  Match.value(error.reason).pipe(
    Match.when('AcquireFailed', () => `acquire failed: ${error.message}`),
    Match.when('PromptFailed', () => `prompt failed: ${error.message}`),
    Match.when('ReadFailed', () => `read failed: ${error.message}`),
    Match.when('DecodeFailed', () => `decode failed: ${error.message}`),
    Match.exhaustive,
  )
