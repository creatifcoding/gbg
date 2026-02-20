/**
 * Genifer Tool Protocol — Bridges genifer components to harness tool calling
 *
 * Design:
 *   - GeniferToolDefinition wraps pi-ai Tool shape (name, description, TypeBox params)
 *   - GeniferToolCall / GeniferToolResult mirror harness event lifecycle
 *   - ToolRegistryService manages client-side tools with atom state
 *   - Execution dispatches to registered handlers OR delegates to harness PiAiToolRuntime
 *
 * Alignment with harness:
 *   - Tool parameters use TypeBox (constraint D3 from pi-sdk-ref)
 *   - ToolCall shape matches pi-ai ToolCall (id, name, arguments)
 *   - Result shape matches pi-ai ToolResultMessage (content, isError)
 *   - Lifecycle states match morphchat ToolInvocationState
 *
 * @module genifer/core/tools
 */

import { Schema } from 'effect'

// =============================================================================
// Tool Lifecycle (mirrors morphchat ToolInvocationState)
// =============================================================================

export const ToolInvocationState = Schema.Literal(
  'pending',            // Tool call received, input parsing
  'running',            // Executing handler
  'approval-required',  // Awaiting user confirmation
  'approved',           // User approved, executing
  'completed',          // Output available
  'error',              // Error occurred
  'denied',             // User denied execution
)
export type ToolInvocationState = typeof ToolInvocationState.Type

// =============================================================================
// Tool Definition — compatible with pi-ai Tool<TParameters>
// =============================================================================

/**
 * Client-side tool definition for genifer components.
 *
 * Matches pi-ai Tool interface:
 *   { name: string, description: string, parameters: TSchema }
 *
 * Plus genifer-specific extensions:
 *   - requiresApproval: gates execution on user confirm
 *   - handler: the actual execute function
 *   - componentKey: optional binding to a specific interactable element
 */
export class GeniferToolDefinition extends Schema.Class<GeniferToolDefinition>('GeniferToolDefinition')({
  /** Unique tool name (must match pi-ai tool name if bridging) */
  name: Schema.String,
  /** Human-readable description for the LLM */
  description: Schema.String,
  /** Human-readable label for UI display */
  label: Schema.optional(Schema.String),
  /** TypeBox schema as serialized JSON Schema (for storage/transport) */
  parametersSchema: Schema.optional(Schema.Unknown),
  /** Whether execution requires user approval */
  requiresApproval: Schema.optional(Schema.Boolean),
  /** Optional binding to a specific interactable element */
  componentKey: Schema.optional(Schema.String),
}) {
  get displayLabel(): string {
    return this.label ?? this.name
  }
}

// =============================================================================
// Tool Call — matches pi-ai ToolCall shape
// =============================================================================

/**
 * A tool invocation request (from LLM or programmatic).
 *
 * Diverges from pi-ai ToolCall by design:
 *   - Uses `args` instead of `arguments` (reserved word in strict mode)
 *   - No `type: "toolCall"` discriminator (uses Schema.Class _tag instead)
 * Use toPiAiToolCall() / fromPiAiToolCall() for harness bridge.
 */
export class GeniferToolCall extends Schema.Class<GeniferToolCall>('GeniferToolCall')({
  /** Unique call ID (from LLM or generated) */
  id: Schema.String,
  /** Tool name — must match a registered GeniferToolDefinition.name */
  name: Schema.String,
  /** Parsed arguments */
  args: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Current lifecycle state */
  state: ToolInvocationState,
  /** Timestamp of call creation */
  timestamp: Schema.Number,
  /** Source: who initiated this call */
  source: Schema.optional(Schema.Literal('llm', 'user', 'system')),
}) {}

// =============================================================================
// Tool Result — matches pi-ai ToolResultMessage shape
// =============================================================================

/**
 * Tool execution result.
 *
 * Diverges from pi-ai ToolResultMessage by design:
 *   - `content` is flat string (not array of content parts)
 *   - `callId` instead of `toolCallId`
 *   - `data` instead of `details`
 * Use toPiAiToolResult() / fromPiAiToolResult() for harness bridge.
 */
export class GeniferToolResult extends Schema.Class<GeniferToolResult>('GeniferToolResult')({
  /** Matches the GeniferToolCall.id */
  callId: Schema.String,
  /** Tool name (for convenience) */
  toolName: Schema.String,
  /** Text content of the result */
  content: Schema.String,
  /** Whether this is an error result */
  isError: Schema.Boolean,
  /** Structured output (optional, for programmatic consumption) */
  data: Schema.optional(Schema.Unknown),
  /** Completion timestamp */
  timestamp: Schema.Number,
}) {}

// =============================================================================
// Tool Handler — the actual execution function
// =============================================================================

/**
 * Tool handler function signature.
 *
 * Mirrors AgentTool.execute from pi-agent-core:
 *   (toolCallId, params, signal?, onUpdate?) => Promise<AgentToolResult>
 *
 * Simplified for client-side: no onUpdate streaming (genifer handles that
 * via atom subscriptions instead).
 */
export type GeniferToolHandler = (
  callId: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<{ content: string; data?: unknown; isError?: boolean }>

// =============================================================================
// pi-ai ↔ genifer Adapters
// =============================================================================
// Genifer maintains its own internal shapes (args, callId, content:string).
// These adapters bridge to/from pi-ai shapes for harness integration.
//
// Divergences (by design):
//   genifer GeniferToolCall.args      ↔ pi-ai ToolCall.arguments
//   genifer GeniferToolCall (no type) ↔ pi-ai ToolCall.type = "toolCall"
//   genifer GeniferToolResult.callId  ↔ pi-ai ToolResultMessage.toolCallId
//   genifer GeniferToolResult.content ↔ pi-ai ToolResultMessage.content (array)
//   genifer GeniferToolResult.data    ↔ pi-ai ToolResultMessage.details
// =============================================================================

/** pi-ai ToolCall shape (subset for adapter — avoids importing pi-ai) */
export type PiAiToolCall = {
  readonly type: 'toolCall'
  readonly id: string
  readonly name: string
  readonly arguments: Record<string, unknown>
  readonly thoughtSignature?: string
}

/** pi-ai ToolResultMessage shape (subset for adapter) */
export type PiAiToolResultMessage = {
  readonly role: 'toolResult'
  readonly toolCallId: string
  readonly toolName: string
  readonly content: ReadonlyArray<{ type: 'text'; text: string }>
  readonly isError: boolean
  readonly details?: unknown
  readonly timestamp: number
}

/**
 * Convert genifer tool call → pi-ai ToolCall shape.
 */
export function toPiAiToolCall(call: GeniferToolCall): PiAiToolCall {
  return {
    type: 'toolCall',
    id: call.id,
    name: call.name,
    arguments: call.args as Record<string, unknown>,
  }
}

/**
 * Convert pi-ai ToolCall → genifer GeniferToolCall.
 */
export function fromPiAiToolCall(
  piCall: PiAiToolCall,
  options?: { state?: ToolInvocationState; source?: 'llm' | 'user' | 'system' },
): GeniferToolCall {
  return new GeniferToolCall({
    id: piCall.id,
    name: piCall.name,
    args: piCall.arguments,
    state: options?.state ?? 'pending',
    timestamp: Date.now(),
    source: options?.source ?? 'llm',
  })
}

/**
 * Convert genifer tool result → pi-ai ToolResultMessage shape.
 */
export function toPiAiToolResult(result: GeniferToolResult): PiAiToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: result.callId,
    toolName: result.toolName,
    content: [{ type: 'text', text: result.content }],
    isError: result.isError,
    details: result.data,
    timestamp: result.timestamp,
  }
}

/**
 * Convert pi-ai ToolResultMessage → genifer GeniferToolResult.
 * Flattens content array into single text string.
 */
export function fromPiAiToolResult(piResult: PiAiToolResultMessage): GeniferToolResult {
  const text = piResult.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('')

  return new GeniferToolResult({
    callId: piResult.toolCallId,
    toolName: piResult.toolName,
    content: text,
    isError: piResult.isError,
    data: piResult.details,
    timestamp: piResult.timestamp,
  })
}
