/**
 * AI Core Tool Schemas
 *
 * Unified tool abstraction layer for AI providers.
 * Bridges MCP tool format with AI SDK tool format.
 *
 * Features:
 * - JSON Schema for tool input validation
 * - Tool call lifecycle tracking
 * - Multi-server aggregation support
 */

import { Schema } from 'effect'

// =============================================================================
// JSON Schema Types (for tool input validation)
// =============================================================================

/**
 * JSON Schema property type
 */
export const JSONSchemaType = Schema.Literal(
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null'
)
export type JSONSchemaType = typeof JSONSchemaType.Type

/**
 * JSON Schema property definition (simplified for runtime use)
 */
export interface JSONSchemaProperty {
  readonly type: JSONSchemaType | readonly JSONSchemaType[]
  readonly description?: string
  readonly enum?: readonly unknown[]
  readonly default?: unknown
  readonly items?: JSONSchemaProperty
  readonly properties?: Record<string, JSONSchemaProperty>
  readonly required?: readonly string[]
}

/**
 * JSON Schema for tool input
 */
export interface JSONSchema {
  readonly type: 'object'
  readonly properties?: Record<string, JSONSchemaProperty>
  readonly required?: readonly string[]
  readonly additionalProperties?: boolean
}

// Schema versions for validation
export const JSONSchemaPropertySchema: Schema.Schema<JSONSchemaProperty> = Schema.Struct({
  type: Schema.Union(JSONSchemaType, Schema.Array(JSONSchemaType)),
  description: Schema.optional(Schema.String),
  enum: Schema.optional(Schema.Array(Schema.Unknown)),
  default: Schema.optional(Schema.Unknown),
  items: Schema.optional(Schema.suspend(() => JSONSchemaPropertySchema)),
  properties: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.suspend(() => JSONSchemaPropertySchema) })
  ),
  required: Schema.optional(Schema.Array(Schema.String)),
})

export const JSONSchemaSchema: Schema.Schema<JSONSchema> = Schema.Struct({
  type: Schema.Literal('object'),
  properties: Schema.optional(Schema.Record({ key: Schema.String, value: JSONSchemaPropertySchema })),
  required: Schema.optional(Schema.Array(Schema.String)),
  additionalProperties: Schema.optional(Schema.Boolean),
})

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Unified tool definition compatible with both MCP and AI SDK
 */
export class ToolDefinition extends Schema.Class<ToolDefinition>('ToolDefinition')({
  /** Unique tool name (may include server prefix for namespacing) */
  name: Schema.String,
  /** Human-readable description */
  description: Schema.String,
  /** JSON Schema for input parameters */
  inputSchema: Schema.NullOr(JSONSchemaSchema),
  /** MCP server ID that provides this tool */
  serverId: Schema.NullOr(Schema.String),
  /** Whether tool is currently available */
  available: Schema.optionalWith(Schema.Boolean, { default: () => true }),
}) {
  /**
   * Get fully qualified tool name (serverId:toolName)
   */
  get qualifiedName(): string {
    return this.serverId ? `${this.serverId}:${this.name}` : this.name
  }
}

// =============================================================================
// Tool Call Lifecycle
// =============================================================================

/**
 * Tool call status
 */
export const ToolCallStatus = Schema.Literal('pending', 'executing', 'completed', 'error')
export type ToolCallStatus = typeof ToolCallStatus.Type

/**
 * Tool call request
 */
export class ToolCallRequest extends Schema.Class<ToolCallRequest>('ToolCallRequest')({
  /** Unique call ID */
  callId: Schema.String,
  /** Tool name */
  toolName: Schema.String,
  /** MCP server ID (if tool is from MCP) */
  serverId: Schema.NullOr(Schema.String),
  /** Tool arguments */
  args: Schema.Unknown,
  /** Request timestamp */
  requestedAt: Schema.Number,
}) {}

/**
 * Tool call result
 */
export class ToolCallResult extends Schema.Class<ToolCallResult>('ToolCallResult')({
  /** Original call ID */
  callId: Schema.String,
  /** Tool name */
  toolName: Schema.String,
  /** MCP server ID */
  serverId: Schema.NullOr(Schema.String),
  /** Result content */
  result: Schema.Unknown,
  /** Whether execution succeeded */
  success: Schema.Boolean,
  /** Error message if failed */
  error: Schema.NullOr(Schema.String),
  /** Execution duration in ms */
  durationMs: Schema.Number,
  /** Completion timestamp */
  completedAt: Schema.Number,
}) {}

/**
 * Active tool call (in-flight)
 */
export class ActiveToolCall extends Schema.Class<ActiveToolCall>('ActiveToolCall')({
  /** Original request */
  request: ToolCallRequest,
  /** Current status */
  status: ToolCallStatus,
  /** Partial result (for streaming tools) */
  partialResult: Schema.NullOr(Schema.Unknown),
  /** Final result (when completed) */
  result: Schema.NullOr(ToolCallResult),
}) {}

// =============================================================================
// Tool Registry State
// =============================================================================

/**
 * Aggregated tool from a specific server
 */
export const AggregatedTool = Schema.Struct({
  tool: ToolDefinition,
  serverId: Schema.String,
  serverName: Schema.String,
})
export type AggregatedTool = typeof AggregatedTool.Type

/**
 * Tool registry state
 */
export class ToolRegistryState extends Schema.Class<ToolRegistryState>('ToolRegistryState')({
  /** All available tools from all servers */
  tools: Schema.Array(AggregatedTool),
  /** Active tool calls */
  activeCalls: Schema.Array(ActiveToolCall),
  /** Last refresh timestamp */
  lastRefreshed: Schema.NullOr(Schema.Number),
  /** Whether registry is loading */
  isLoading: Schema.Boolean,
}) {
  static readonly Initial: ToolRegistryState = new ToolRegistryState({
    tools: [],
    activeCalls: [],
    lastRefreshed: null,
    isLoading: false,
  })

  /**
   * Find tool by name (searches across all servers)
   */
  findTool(name: string): AggregatedTool | undefined {
    // Try exact match first
    const exact = this.tools.find((t) => t.tool.name === name)
    if (exact) return exact

    // Try qualified match (serverId:toolName)
    const qualified = this.tools.find((t) => t.tool.qualifiedName === name)
    return qualified
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverId: string): readonly AggregatedTool[] {
    return this.tools.filter((t) => t.serverId === serverId)
  }
}

// =============================================================================
// AI SDK Tool Format Conversion
// =============================================================================

/**
 * Convert ToolDefinition to AI SDK tool format
 */
export const toAISDKTool = (
  tool: ToolDefinition
): {
  name: string
  description: string
  parameters: Record<string, unknown>
} => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema
    ? {
        type: 'object',
        properties: tool.inputSchema.properties ?? {},
        required: tool.inputSchema.required ?? [],
      }
    : { type: 'object', properties: {} },
})

/**
 * Convert all tools to AI SDK format
 */
export const toAISDKTools = (
  tools: readonly ToolDefinition[]
): Array<{
  name: string
  description: string
  parameters: Record<string, unknown>
}> => tools.map(toAISDKTool)

// =============================================================================
// MCP Tool Conversion
// =============================================================================

/**
 * Convert MCP tool to ToolDefinition
 */
export const fromMCPTool = (
  mcpTool: { name: string; description: string; inputSchema?: Record<string, unknown> },
  serverId: string
): ToolDefinition =>
  new ToolDefinition({
    name: mcpTool.name,
    description: mcpTool.description,
    inputSchema: (mcpTool.inputSchema as JSONSchema | undefined) ?? null,
    serverId,
    available: true,
  })

/**
 * Convert MCP tools to ToolDefinitions
 */
export const fromMCPTools = (
  mcpTools: readonly { name: string; description: string; inputSchema?: Record<string, unknown> }[],
  serverId: string
): readonly ToolDefinition[] => mcpTools.map((t) => fromMCPTool(t, serverId))
