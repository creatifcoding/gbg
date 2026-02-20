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
 * Matches pi-ai ToolCall:
 *   { type: "toolCall", id: string, name: string, arguments: Record<string, any> }
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
 * Matches pi-ai ToolResultMessage content model:
 *   { content: [{type: "text", text: string}], isError: boolean }
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
