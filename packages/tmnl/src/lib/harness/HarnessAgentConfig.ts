/**
 * HarnessAgentConfig — per-agent configuration for the harness engine.
 *
 * Controls tool execution bounds, timeouts, and behavioral tuning.
 * Defaults are permissive (Infinity tool rounds) to match upstream
 * pi-agent-core Agent behavior — the model decides when to stop.
 *
 * @module harness/HarnessAgentConfig
 */

import { Context, Layer, Schema } from 'effect'

// =============================================================================
// Schema
// =============================================================================

export class HarnessAgentConfig extends Schema.Class<HarnessAgentConfig>('HarnessAgentConfig')({
  /**
   * Maximum tool execution rounds per prompt before the engine force-stops.
   * Set to `Infinity` (default) to let the model decide when to stop.
   * Set to a finite number for safety bounds in untrusted environments.
   */
  maxToolRounds: Schema.optionalWith(Schema.Number, { default: () => Infinity }),

  /**
   * Per-tool execution timeout in milliseconds.
   * Individual tool calls that exceed this are killed.
   * Default: 120_000 (2 minutes).
   */
  toolExecutionTimeoutMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    default: () => 120_000,
  }),

  /**
   * Bash tool timeout in milliseconds (passed to SDK bash tool).
   * Default: 30_000 (30 seconds).
   */
  bashTimeoutMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    default: () => 30_000,
  }),

  /**
   * Working directory for tool execution.
   * Default: process.cwd()
   */
  cwd: Schema.optionalWith(Schema.String, { default: () => process.cwd() }),
}) {}

// =============================================================================
// Context Tag + Layers
// =============================================================================

export const HarnessAgentConfigTag = Context.GenericTag<HarnessAgentConfig>(
  'tmnl/harness/HarnessAgentConfig',
)

/** Default config — Infinity rounds, 2min tool timeout, 30s bash, cwd */
export const HarnessAgentConfigDefault = Layer.succeed(
  HarnessAgentConfigTag,
  new HarnessAgentConfig({}),
)

/** Custom config layer */
export const HarnessAgentConfigFrom = (config: Partial<HarnessAgentConfig>) =>
  Layer.succeed(HarnessAgentConfigTag, new HarnessAgentConfig(config))
