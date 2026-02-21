/**
 * AgentHarnessConfig — per-agent harness configuration via Effect Config.
 *
 * Controls tool execution bounds, timeouts, and behavioral tuning.
 * Env-sourced with permissive defaults (Infinity tool rounds) to match
 * upstream pi-agent-core Agent behavior — the model decides when to stop.
 *
 * Two construction paths:
 *   1. `AgentHarnessConfigDefault` — reads `TMNL_AGENT_*` env vars
 *   2. `AgentHarnessConfigFrom({...})` — plain JSON object, no env resolution
 *
 * @module agents/AgentHarnessConfig
 */

import { Config, Context, Effect, Layer, Schema } from 'effect'

// =============================================================================
// Defaults (shared between env + JSON paths)
// =============================================================================

const DEFAULTS = {
  maxToolRounds: Infinity,
  bashTimeoutMs: 30_000,
  cwd: process.cwd(),
} as const

// =============================================================================
// Schema (runtime-validated shape)
// =============================================================================

export class AgentHarnessConfig extends Schema.Class<AgentHarnessConfig>('AgentHarnessConfig')({
  /**
   * Maximum tool execution rounds per prompt before the engine force-stops.
   * `Infinity` (default) = model decides when to stop.
   * Finite number = safety bound for untrusted environments.
   */
  maxToolRounds: Schema.optionalWith(Schema.Number, { default: () => DEFAULTS.maxToolRounds }),

  /**
   * Bash tool timeout in milliseconds (passed to SDK bash tool).
   * Default: 30_000 (30 seconds).
   */
  bashTimeoutMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    default: () => DEFAULTS.bashTimeoutMs,
  }),

  /**
   * Working directory for tool execution.
   */
  cwd: Schema.optionalWith(Schema.String, { default: () => DEFAULTS.cwd }),
}) {}

// =============================================================================
// Context Tag
// =============================================================================

export const AgentHarnessConfigTag = Context.GenericTag<AgentHarnessConfig>(
  'tmnl/agents/AgentHarnessConfig',
)

// =============================================================================
// Config Source (env vars → validated Config)
// =============================================================================

const positiveIntegerConfig = (name: string, defaultValue: number) =>
  Config.integer(name).pipe(
    Config.withDefault(defaultValue),
    Config.validate({
      message: `${name} must be > 0`,
      validation: (value) => value > 0,
    }),
  )

/**
 * Number config that supports Infinity via sentinel string "Infinity".
 * Config.number doesn't parse "Infinity", so we read as string and coerce.
 */
const numberOrInfinityConfig = (name: string, defaultValue: number) =>
  Config.string(name).pipe(
    Config.withDefault(String(defaultValue)),
    Config.map((raw) => {
      if (raw.toLowerCase() === 'infinity') return Infinity
      const n = Number(raw)
      if (Number.isNaN(n)) return defaultValue
      return n
    }),
  )

const AgentHarnessConfigSource = Config.all({
  maxToolRounds: numberOrInfinityConfig('TMNL_AGENT_MAX_TOOL_ROUNDS', DEFAULTS.maxToolRounds),
  bashTimeoutMs: positiveIntegerConfig('TMNL_AGENT_BASH_TIMEOUT_MS', DEFAULTS.bashTimeoutMs),
  cwd: Config.string('TMNL_AGENT_CWD').pipe(Config.withDefault(DEFAULTS.cwd)),
})

// =============================================================================
// Layers
// =============================================================================

/** Env-sourced: reads `TMNL_AGENT_*` vars, falls back to permissive defaults. */
export const AgentHarnessConfigDefault = Layer.effect(
  AgentHarnessConfigTag,
  Effect.gen(function* () {
    const raw = yield* AgentHarnessConfigSource
    return new AgentHarnessConfig(raw)
  }),
)

/** JSON object: partial overrides, Schema defaults fill the rest. No env. */
export const AgentHarnessConfigFrom = (
  overrides: Partial<typeof AgentHarnessConfig.Type>,
) =>
  Layer.succeed(AgentHarnessConfigTag, new AgentHarnessConfig(overrides))
