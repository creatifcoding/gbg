/**
 * IIoT Deployment Mode Configuration
 *
 * Config-driven layer selection for IIoT service stacks.
 * The deployment mode determines which state service implementations are used.
 *
 * Modes:
 * - `test` — In-memory state services (unit/integration tests)
 * - `tauri` — Local SQLite-backed state (desktop app)
 * - `cluster` — PostgreSQL + NATS distributed stack (production)
 *
 * @module @gbg/tmnl/iiot/infrastructure/deployment-mode
 */

import { Schema, Context, Layer, Effect, Option } from 'effect'

// =============================================================================
// Schema
// =============================================================================

/**
 * IIoT deployment mode.
 *
 * Determines which state service implementations are wired:
 * - `test` → AllStateServicesInMemory (no persistence)
 * - `tauri` → SQLite-backed state (local, single-process)
 * - `cluster` → PostgreSQL + NATS (distributed, multi-node)
 */
export const DeploymentMode = Schema.Literal('test', 'tauri', 'cluster').pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/DeploymentMode',
    description: 'IIoT deployment mode for layer selection',
  })
)
export type DeploymentMode = typeof DeploymentMode.Type

// =============================================================================
// Config Shape
// =============================================================================

/** Deployment mode configuration shape */
export interface DeploymentModeConfigShape {
  readonly mode: DeploymentMode
}

// =============================================================================
// Context.Tag
// =============================================================================

/**
 * DeploymentModeConfig service tag.
 *
 * Resolved at app bootstrap to select the appropriate layer stack.
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const { mode } = yield* DeploymentModeConfig
 *   // mode: 'test' | 'tauri' | 'cluster'
 * })
 * ```
 */
export class DeploymentModeConfig extends Context.Tag('iiot/DeploymentModeConfig')<
  DeploymentModeConfig,
  DeploymentModeConfigShape
>() {}

// =============================================================================
// Pre-built Layers
// =============================================================================

/** Test mode — in-memory state services */
export const DeploymentModeTestLayer: Layer.Layer<DeploymentModeConfig> =
  Layer.succeed(DeploymentModeConfig, { mode: 'test' as DeploymentMode })

/** Tauri mode — SQLite-backed local state */
export const DeploymentModeTauriLayer: Layer.Layer<DeploymentModeConfig> =
  Layer.succeed(DeploymentModeConfig, { mode: 'tauri' as DeploymentMode })

/** Cluster mode — PostgreSQL + NATS distributed */
export const DeploymentModeClusterLayer: Layer.Layer<DeploymentModeConfig> =
  Layer.succeed(DeploymentModeConfig, { mode: 'cluster' as DeploymentMode })

// =============================================================================
// Environment-driven Layer
// =============================================================================

/**
 * Reads deployment mode from environment variable `IIOT_DEPLOYMENT_MODE`.
 *
 * Falls back to 'test' if not set or invalid.
 *
 * Usage:
 * ```ts
 * // In app bootstrap
 * const AppLayer = IIoTRuntimeLayer.pipe(
 *   Layer.provide(DeploymentModeEnvLayer),
 * )
 * ```
 */
export const DeploymentModeEnvLayer: Layer.Layer<DeploymentModeConfig> =
  Layer.effect(
    DeploymentModeConfig,
    Effect.sync(() => {
      const raw = typeof process !== 'undefined'
        ? process.env['IIOT_DEPLOYMENT_MODE']
        : undefined
      const parsed = Schema.decodeUnknownOption(DeploymentMode)(raw)
      const mode = Option.getOrElse(parsed, () => 'test' as DeploymentMode)
      return { mode }
    })
  )
