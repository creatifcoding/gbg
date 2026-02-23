/**
 * InteractiveShellConfig — Runtime configuration for the interactive shell tool.
 *
 * Loaded from Config source (env vars, file, defaults).
 * Configures: pool sizing, buffer limits, default modes, timeout.
 *
 * @module harness/interactive-shell/config
 */

import { Schema, Config, Effect, Layer, Context } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export class InteractiveShellConfig extends Schema.Class<InteractiveShellConfig>(
  'InteractiveShellConfig',
)({
  /** Default shell to use when command is a single word. @default $SHELL or /bin/bash */
  defaultShell: Schema.optionalWith(Schema.String, { default: () => process.env.SHELL || '/bin/bash' }),
  /** Default terminal columns. @default 120 */
  defaultCols: Schema.optionalWith(Schema.Number, { default: () => 120 }),
  /** Default terminal rows. @default 24 */
  defaultRows: Schema.optionalWith(Schema.Number, { default: () => 24 }),
  /** Max raw output buffer per session (bytes). @default 524288 (512KB) */
  maxOutputBuffer: Schema.optionalWith(Schema.Number, { default: () => 524288 }),
  /** Default mode for new sessions. @default 'interactive' */
  defaultMode: Schema.optionalWith(
    Schema.Literal('interactive', 'hands-free', 'dispatch'),
    { default: () => 'interactive' as const },
  ),
  /** Default timeout in ms (0 = no timeout). @default 0 */
  defaultTimeout: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Quiet threshold in ms for hands-free/dispatch auto-exit. @default 5000 */
  quietThreshold: Schema.optionalWith(Schema.Number, { default: () => 5000 }),
  /** Lines to include in completion notification snapshots. @default 50 */
  completionNotifyLines: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  /** Max chars in completion notification snapshots. @default 5000 */
  completionNotifyMaxChars: Schema.optionalWith(Schema.Number, { default: () => 5000 }),
  /** Min worker threads. @default 1 */
  poolMinSize: Schema.optionalWith(Schema.Number, { default: () => 1 }),
  /** Max worker threads. @default 8 */
  poolMaxSize: Schema.optionalWith(Schema.Number, { default: () => 8 }),
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag + Layers
// ─────────────────────────────────────────────────────────────────────────────

export class InteractiveShellConfigTag extends Context.Tag(
  'tmnl/harness/InteractiveShellConfig',
)<InteractiveShellConfigTag, InteractiveShellConfig>() {}

/** Default config (all defaults). */
export const InteractiveShellConfigDefault = Layer.succeed(
  InteractiveShellConfigTag,
  new InteractiveShellConfig({}),
)

/** Config from env vars. */
export const InteractiveShellConfigFromEnv = Layer.effect(
  InteractiveShellConfigTag,
  Effect.gen(function* () {
    const shell = yield* Config.string('TMNL_SHELL_DEFAULT').pipe(Config.withDefault(process.env.SHELL || '/bin/bash'))
    const cols = yield* Config.integer('TMNL_SHELL_COLS').pipe(Config.withDefault(120))
    const rows = yield* Config.integer('TMNL_SHELL_ROWS').pipe(Config.withDefault(24))
    const timeout = yield* Config.integer('TMNL_SHELL_TIMEOUT').pipe(Config.withDefault(0))
    const quietMs = yield* Config.integer('TMNL_SHELL_QUIET_MS').pipe(Config.withDefault(5000))
    const poolMin = yield* Config.integer('TMNL_SHELL_POOL_MIN').pipe(Config.withDefault(1))
    const poolMax = yield* Config.integer('TMNL_SHELL_POOL_MAX').pipe(Config.withDefault(8))

    return new InteractiveShellConfig({
      defaultShell: shell,
      defaultCols: cols,
      defaultRows: rows,
      defaultTimeout: timeout,
      quietThreshold: quietMs,
      poolMinSize: poolMin,
      poolMaxSize: poolMax,
    })
  }),
)
