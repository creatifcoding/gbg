/**
 * Agent Execution Service
 *
 * Parses CTL agent output and executes suggested actions.
 * Used by the steering framework to automate agent workflows.
 *
 * @module @gbg/ctl/core/services/agent-execution
 */

import { Context, Effect, Layer, Schema, pipe } from "effect"
import {
  CtlAgentOutput,
  AgentAction,
  type ActionCategory,
} from "../domain/agent-output.js"

// =============================================================================
// EXECUTION RESULT
// =============================================================================

/**
 * Result of executing an agent action
 */
export const ExecutionResult = Schema.Struct({
  /** The action that was executed */
  action: AgentAction,
  /** Whether execution succeeded */
  success: Schema.Boolean,
  /** Output from the execution */
  output: Schema.optional(Schema.Unknown),
  /** Error if execution failed */
  error: Schema.optional(Schema.String),
  /** Duration in milliseconds */
  durationMs: Schema.Number,
})
export type ExecutionResult = Schema.Schema.Type<typeof ExecutionResult>

// =============================================================================
// AGENT EXECUTION PORT
// =============================================================================

/**
 * Port for agent execution operations
 */
export interface AgentExecutionPort {
  /**
   * Parse CTL output from JSON string
   */
  readonly parse: (json: string) => Effect.Effect<CtlAgentOutput, Error>

  /**
   * Execute a single action
   */
  readonly executeAction: (action: AgentAction) => Effect.Effect<ExecutionResult>

  /**
   * Execute all auto-executable actions from output
   */
  readonly executeAutoActions: (output: CtlAgentOutput) => Effect.Effect<readonly ExecutionResult[]>

  /**
   * Get actions filtered by category
   */
  readonly getActionsByCategory: (
    output: CtlAgentOutput,
    category: ActionCategory
  ) => readonly AgentAction[]

  /**
   * Get the recommended next action based on steering signal
   */
  readonly getRecommendedAction: (output: CtlAgentOutput) => AgentAction | undefined

  /**
   * Determine if output requires human intervention
   */
  readonly requiresHumanIntervention: (output: CtlAgentOutput) => boolean

  /**
   * Get skill invocation commands for suggested skills
   */
  readonly getSkillCommands: (output: CtlAgentOutput) => readonly string[]
}

/**
 * Agent execution service tag
 */
export class AgentExecution extends Context.Tag("ctl/AgentExecution")<
  AgentExecution,
  AgentExecutionPort
>() {}

// =============================================================================
// DEFAULT IMPLEMENTATION
// =============================================================================

const makeAgentExecution = (): AgentExecutionPort => ({
  parse: (json: string) =>
    Effect.try({
      try: () => {
        const parsed = JSON.parse(json)
        // Validate _type discriminator
        if (parsed._type !== "ctl_output") {
          throw new Error(`Invalid output type: expected "ctl_output", got "${parsed._type}"`)
        }
        return new CtlAgentOutput(parsed)
      },
      catch: (e) => new Error(`Failed to parse CTL output: ${e}`),
    }),

  executeAction: (action: AgentAction) =>
    Effect.promise(async () => {
      const startTime = Date.now()

      try {
        // Execute via shell using Bun
        const proc = Bun.spawn(["sh", "-c", action.command], {
          stdout: "pipe",
          stderr: "pipe",
        })

        const exitCode = await proc.exited
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()

        const durationMs = Date.now() - startTime

        if (exitCode === 0) {
          return {
            action,
            success: true,
            output: stdout.trim() || undefined,
            durationMs,
          } satisfies ExecutionResult
        } else {
          return {
            action,
            success: false,
            error: stderr.trim() || `Exit code: ${exitCode}`,
            durationMs,
          } satisfies ExecutionResult
        }
      } catch (e) {
        return {
          action,
          success: false,
          error: String(e),
          durationMs: Date.now() - startTime,
        } satisfies ExecutionResult
      }
    }),

  executeAutoActions: (output: CtlAgentOutput) =>
    Effect.gen(function* () {
      // Only execute auto-executable actions (fix, query) that don't require confirmation
      const autoActions = output.actions.filter(
        (a) =>
          !a.confirm &&
          (a.category === "fix" || a.category === "query")
      )

      const results: ExecutionResult[] = []
      for (const action of autoActions) {
        const result = yield* makeAgentExecution().executeAction(action)
        results.push(result)
      }

      return results
    }),

  getActionsByCategory: (output: CtlAgentOutput, category: ActionCategory) =>
    output.actions.filter((a) => a.category === category),

  getRecommendedAction: (output: CtlAgentOutput) => {
    // Priority order: critical > high > normal > low
    const priorities: readonly ("critical" | "high" | "normal" | "low")[] = [
      "critical",
      "high",
      "normal",
      "low",
    ]

    for (const priority of priorities) {
      const action = output.actions.find((a) => a.priority === priority)
      if (action) return action
    }

    return output.actions[0]
  },

  requiresHumanIntervention: (output: CtlAgentOutput) => {
    // Requires human if:
    // 1. Steering signal is "escalate" or "await_input"
    // 2. Any action requires confirmation
    // 3. Error is not recoverable
    return (
      output.steering === "escalate" ||
      output.steering === "await_input" ||
      output.actions.some((a) => a.confirm) ||
      (output.error?.recoverable === false)
    )
  },

  getSkillCommands: (output: CtlAgentOutput) =>
    output.suggestedSkills.map((skill) => `/${skill}`),
})

// =============================================================================
// LAYER
// =============================================================================

export const AgentExecutionLayer = Layer.succeed(AgentExecution, makeAgentExecution())

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Parse and validate CTL output from stdout
 */
export const parseCtlOutput = (stdout: string): Effect.Effect<CtlAgentOutput, Error> =>
  pipe(
    Effect.succeed(stdout.trim()),
    Effect.flatMap((json) => makeAgentExecution().parse(json))
  )

/**
 * Create an action builder for fluent construction
 */
export const action = (name: string) => ({
  description: (desc: string) => ({
    command: (cmd: string) => ({
      build: (): AgentAction =>
        new AgentAction({
          name,
          description: desc,
          command: cmd,
        }),
      category: (cat: ActionCategory) => ({
        build: (): AgentAction =>
          new AgentAction({
            name,
            description: desc,
            command: cmd,
            category: cat,
          }),
        priority: (pri: "critical" | "high" | "normal" | "low") => ({
          build: (): AgentAction =>
            new AgentAction({
              name,
              description: desc,
              command: cmd,
              category: cat,
              priority: pri,
            }),
          confirm: () => ({
            build: (): AgentAction =>
              new AgentAction({
                name,
                description: desc,
                command: cmd,
                category: cat,
                priority: pri,
                confirm: true,
              }),
          }),
        }),
      }),
    }),
  }),
})
