/**
 * Agent Output Schema
 *
 * Structured output for agent steering framework.
 * Used when CTL is invoked with --agent flag.
 *
 * @module @gbg/ctl/core/domain/agent-output
 */

import { Schema } from "effect"

// =============================================================================
// ACTION CATEGORIES
// =============================================================================

/**
 * Action category for agent routing
 */
export const ActionCategory = Schema.Literal(
  "fix",       // Fix an issue (auto-executable)
  "create",    // Create new resource
  "update",    // Update existing resource
  "delete",    // Delete resource (requires confirm)
  "navigate",  // Navigate/explore
  "invoke",    // Invoke skill or command
  "query"      // Read-only query
)
export type ActionCategory = Schema.Schema.Type<typeof ActionCategory>

/**
 * Priority level for actions
 */
export const ActionPriority = Schema.Literal("critical", "high", "normal", "low")
export type ActionPriority = Schema.Schema.Type<typeof ActionPriority>

// =============================================================================
// AGENT ACTION
// =============================================================================

/**
 * An action that an agent can take based on CTL output
 */
export class AgentAction extends Schema.Class<AgentAction>("AgentAction")({
  /** Action identifier */
  name: Schema.NonEmptyString,
  /** Human-readable description */
  description: Schema.String,
  /** CLI command to execute this action */
  command: Schema.String,
  /** Action category for routing */
  category: Schema.optionalWith(ActionCategory, { default: () => "invoke" as const }),
  /** Priority level */
  priority: Schema.optionalWith(ActionPriority, { default: () => "normal" as const }),
  /** Parameters for the action */
  params: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
  /** Whether this action requires user confirmation */
  confirm: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Condition hint for when to use this action */
  when: Schema.optional(Schema.String),
}) {}

// =============================================================================
// STREAMING STATE
// =============================================================================

/**
 * Streaming state for progressive updates
 */
export const StreamingState = Schema.Struct({
  /** Whether the stream is complete */
  complete: Schema.Boolean,
  /** Accumulated chunks */
  chunks: Schema.Array(Schema.Unknown),
  /** Current cursor/offset */
  cursor: Schema.optional(Schema.String),
})

// =============================================================================
// CTL AGENT OUTPUT
// =============================================================================

export const CtlOutputStatus = Schema.Literal("success", "error", "pending", "streaming")
export type CtlOutputStatus = Schema.Schema.Type<typeof CtlOutputStatus>

/**
 * Steering signal for agent workflow control
 */
export const SteeringSignal = Schema.Literal(
  "continue",     // Continue with suggested actions
  "await_input",  // Wait for user input before proceeding
  "complete",     // Task is complete, no further action needed
  "escalate",     // Escalate to human for complex decision
  "retry"         // Retry with different parameters
)
export type SteeringSignal = Schema.Schema.Type<typeof SteeringSignal>

/**
 * Main agent output schema matching steering protocol
 */
export class CtlAgentOutput extends Schema.Class<CtlAgentOutput>("CtlAgentOutput")({
  /** Discriminator for type identification */
  _type: Schema.Literal("ctl_output"),

  /** The command that produced this output */
  command: Schema.String,

  /** Output status */
  status: CtlOutputStatus,

  /** Structured result data (command-specific) */
  result: Schema.optional(Schema.Unknown),

  /** Error details if status is "error" */
  error: Schema.optional(Schema.Struct({
    code: Schema.String,
    message: Schema.String,
    suggestion: Schema.optional(Schema.String),
    skill: Schema.optional(Schema.String),
    recoverable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  })),

  /** Agent-actionable items */
  actions: Schema.optionalWith(Schema.Array(AgentAction), { default: () => [] }),

  /** Skill suggestions for follow-up */
  suggestedSkills: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),

  /** Steering signal for agent workflow */
  steering: Schema.optionalWith(SteeringSignal, { default: () => "continue" as const }),

  /** For streaming/progressive updates */
  streaming: Schema.optional(StreamingState),

  /** Metadata */
  meta: Schema.optional(Schema.Struct({
    /** Execution duration in ms */
    durationMs: Schema.optional(Schema.Number),
    /** CTL version */
    version: Schema.optional(Schema.String),
    /** Timestamp */
    timestamp: Schema.optional(Schema.String),
  })),
}) {}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a success output
 */
export const success = (
  command: string,
  result: unknown,
  options?: {
    actions?: readonly AgentAction[]
    suggestedSkills?: readonly string[]
    steering?: SteeringSignal
    durationMs?: number
  }
): CtlAgentOutput =>
  new CtlAgentOutput({
    _type: "ctl_output",
    command,
    status: "success",
    result,
    actions: options?.actions ? [...options.actions] : [],
    suggestedSkills: options?.suggestedSkills ? [...options.suggestedSkills] : [],
    steering: options?.steering ?? (options?.actions?.length ? "continue" : "complete"),
    meta: {
      durationMs: options?.durationMs,
      timestamp: new Date().toISOString(),
    },
  })

/**
 * Create an error output
 */
export const error = (
  command: string,
  errorInfo: {
    code: string
    message: string
    suggestion?: string
    skill?: string
    recoverable?: boolean
  },
  options?: {
    actions?: readonly AgentAction[]
    suggestedSkills?: readonly string[]
    steering?: SteeringSignal
  }
): CtlAgentOutput =>
  new CtlAgentOutput({
    _type: "ctl_output",
    command,
    status: "error",
    error: {
      code: errorInfo.code,
      message: errorInfo.message,
      suggestion: errorInfo.suggestion,
      skill: errorInfo.skill,
      recoverable: errorInfo.recoverable ?? true,
    },
    actions: options?.actions ? [...options.actions] : [],
    suggestedSkills: options?.suggestedSkills ? [...options.suggestedSkills] : [],
    steering: options?.steering ?? (errorInfo.recoverable === false ? "escalate" : "retry"),
    meta: {
      timestamp: new Date().toISOString(),
    },
  })

/**
 * Create a pending output (for async operations)
 */
export const pending = (
  command: string,
  options?: {
    actions?: readonly AgentAction[]
  }
): CtlAgentOutput =>
  new CtlAgentOutput({
    _type: "ctl_output",
    command,
    status: "pending",
    actions: options?.actions ? [...options.actions] : [],
    meta: {
      timestamp: new Date().toISOString(),
    },
  })

/**
 * Create a streaming output
 */
export const streaming = (
  command: string,
  chunks: readonly unknown[],
  complete: boolean
): CtlAgentOutput =>
  new CtlAgentOutput({
    _type: "ctl_output",
    command,
    status: "streaming",
    streaming: {
      complete,
      chunks: [...chunks],
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  })

// =============================================================================
// SERIALIZATION
// =============================================================================

/**
 * Serialize to JSON string (for stdout)
 */
export const serialize = (output: CtlAgentOutput): string =>
  JSON.stringify(output, null, 0)

/**
 * Serialize to pretty JSON (for debugging)
 */
export const serializePretty = (output: CtlAgentOutput): string =>
  JSON.stringify(output, null, 2)
