/**
 * Deployment Layer Integration Tests
 *
 * Verifies that IIoT deployment profile layers compose correctly
 * and resolve all expected services without missing dependencies.
 *
 * Test Groups:
 * 1. AllStateServicesInMemory: resolves all 12 state service tags
 * 2. IIoTTestLayer: entity handlers compose without error (requires Sharding)
 * 3. IIoTRuntimeLayer: config-driven layer selection
 * 4. DeploymentModeConfig: pre-built layers resolve correct modes
 * 5. DeploymentModeEnvLayer: reads IIOT_DEPLOYMENT_MODE env var
 *
 * NOTE: Entity handlers use @effect/cluster Entity.make() which requires
 * Sharding at runtime. TestRunner.layer provides an in-memory implementation.
 * State services are consumed internally by entity handlers, not re-exported
 * — test state resolution via AllStateServicesInMemory directly.
 *
 * @module
 */

import { describe, expect, it } from 'vitest'
import { Effect, Layer, pipe } from 'effect'
import { TestRunner } from '@effect/cluster'
import {
  IIoTTestLayer,
  IIoTRuntimeLayer,
  AllStateServicesInMemory,
  DeploymentModeConfig,
  DeploymentModeTestLayer,
  DeploymentModeTauriLayer,
  DeploymentModeClusterLayer,
} from '../index'
import { DeploymentModeEnvLayer } from '../../infrastructure/deployment-mode'
import {
  AlarmState,
  WorkOrderState,
  EquipmentStateService,
  SiteState,
  AreaState,
  PlantState,
  LineState,
  WorkCellState,
  MachineState,
  SensorAssetState,
  DeviceState,
  EnterpriseState,
} from '../../state'

// =============================================================================
// AllStateServicesInMemory (State Service Resolution)
// =============================================================================

describe('AllStateServicesInMemory', () => {
  it('resolves AlarmState', async () => {
    const program = Effect.gen(function* () {
      const state = yield* AlarmState
      expect(state).toBeDefined()
      expect(typeof state.create).toBe('function')
    }).pipe(Effect.provide(AllStateServicesInMemory))

    await Effect.runPromise(program)
  })

  it('resolves WorkOrderState', async () => {
    const program = Effect.gen(function* () {
      const state = yield* WorkOrderState
      expect(state).toBeDefined()
      expect(typeof state.create).toBe('function')
    }).pipe(Effect.provide(AllStateServicesInMemory))

    await Effect.runPromise(program)
  })

  it('resolves EquipmentStateService', async () => {
    const program = Effect.gen(function* () {
      const state = yield* EquipmentStateService
      expect(state).toBeDefined()
      expect(typeof state.create).toBe('function')
    }).pipe(Effect.provide(AllStateServicesInMemory))

    await Effect.runPromise(program)
  })

  it('resolves all 12 state services', async () => {
    const program = Effect.gen(function* () {
      const services = [
        yield* AlarmState,
        yield* WorkOrderState,
        yield* EquipmentStateService,
        yield* SiteState,
        yield* AreaState,
        yield* PlantState,
        yield* LineState,
        yield* WorkCellState,
        yield* MachineState,
        yield* SensorAssetState,
        yield* DeviceState,
        yield* EnterpriseState,
      ]
      expect(services).toHaveLength(12)
      services.forEach((svc) => {
        expect(svc).toBeDefined()
        expect(typeof svc.create).toBe('function')
      })
    }).pipe(Effect.provide(AllStateServicesInMemory))

    await Effect.runPromise(program)
  })

  it('state services are functional (alarm create roundtrip)', async () => {
    const program = Effect.gen(function* () {
      const state = yield* AlarmState
      const alarm = yield* state.create({
        deviceId: 'dev-test-001' as any,
        severity: 'critical' as any,
        alarmType: 'high_temperature' as any,
        message: 'Test alarm',
      })
      expect(alarm).toBeDefined()
    }).pipe(Effect.provide(AllStateServicesInMemory))

    await Effect.runPromise(program)
  })
})

// =============================================================================
// IIoTTestLayer (Entity Stack Composition)
// =============================================================================

describe('IIoTTestLayer', () => {
  /**
   * IIoTTestLayer = EntityTestingStack which provides entity handlers.
   * Entity handlers require Sharding (from @effect/cluster).
   * TestRunner.layer provides an in-memory Sharding.
   */
  const FullTestLayer = pipe(
    IIoTTestLayer,
    Layer.provide(TestRunner.layer),
  )

  it('builds without error (entity composition)', async () => {
    const program = Effect.void.pipe(
      Effect.provide(FullTestLayer),
    )
    await Effect.runPromise(program)
  })
})

// =============================================================================
// DeploymentModeConfig
// =============================================================================

describe('DeploymentModeConfig', () => {
  it('resolves test mode from DeploymentModeTestLayer', async () => {
    const program = Effect.gen(function* () {
      const { mode } = yield* DeploymentModeConfig
      expect(mode).toBe('test')
    }).pipe(Effect.provide(DeploymentModeTestLayer))

    await Effect.runPromise(program)
  })

  it('resolves tauri mode from DeploymentModeTauriLayer', async () => {
    const program = Effect.gen(function* () {
      const { mode } = yield* DeploymentModeConfig
      expect(mode).toBe('tauri')
    }).pipe(Effect.provide(DeploymentModeTauriLayer))

    await Effect.runPromise(program)
  })

  it('resolves cluster mode from DeploymentModeClusterLayer', async () => {
    const program = Effect.gen(function* () {
      const { mode } = yield* DeploymentModeConfig
      expect(mode).toBe('cluster')
    }).pipe(Effect.provide(DeploymentModeClusterLayer))

    await Effect.runPromise(program)
  })

  it('DeploymentModeEnvLayer defaults to test when env not set', async () => {
    const original = process.env['IIOT_DEPLOYMENT_MODE']
    delete process.env['IIOT_DEPLOYMENT_MODE']

    try {
      const program = Effect.gen(function* () {
        const { mode } = yield* DeploymentModeConfig
        expect(mode).toBe('test')
      }).pipe(Effect.provide(DeploymentModeEnvLayer))

      await Effect.runPromise(program)
    } finally {
      if (original !== undefined) {
        process.env['IIOT_DEPLOYMENT_MODE'] = original
      }
    }
  })

  it('DeploymentModeEnvLayer reads cluster from env', async () => {
    const original = process.env['IIOT_DEPLOYMENT_MODE']
    process.env['IIOT_DEPLOYMENT_MODE'] = 'cluster'

    try {
      const program = Effect.gen(function* () {
        const { mode } = yield* DeploymentModeConfig
        expect(mode).toBe('cluster')
      }).pipe(Effect.provide(DeploymentModeEnvLayer))

      await Effect.runPromise(program)
    } finally {
      if (original !== undefined) {
        process.env['IIOT_DEPLOYMENT_MODE'] = original
      } else {
        delete process.env['IIOT_DEPLOYMENT_MODE']
      }
    }
  })

  it('DeploymentModeEnvLayer falls back to test for invalid value', async () => {
    const original = process.env['IIOT_DEPLOYMENT_MODE']
    process.env['IIOT_DEPLOYMENT_MODE'] = 'invalid'

    try {
      const program = Effect.gen(function* () {
        const { mode } = yield* DeploymentModeConfig
        expect(mode).toBe('test')
      }).pipe(Effect.provide(DeploymentModeEnvLayer))

      await Effect.runPromise(program)
    } finally {
      if (original !== undefined) {
        process.env['IIOT_DEPLOYMENT_MODE'] = original
      } else {
        delete process.env['IIOT_DEPLOYMENT_MODE']
      }
    }
  })
})

// =============================================================================
// IIoTRuntimeLayer (Config-Driven Selection)
// =============================================================================

describe('IIoTRuntimeLayer', () => {
  it('selects IIoTTestLayer when mode is test (builds without error)', async () => {
    const program = Effect.void.pipe(
      Effect.provide(pipe(
        IIoTRuntimeLayer,
        Layer.provide(DeploymentModeTestLayer),
        Layer.provide(TestRunner.layer),
      )),
    )
    await Effect.runPromise(program)
  })

  it('selects IIoTTestLayer when mode is tauri (builds without error)', async () => {
    const program = Effect.void.pipe(
      Effect.provide(pipe(
        IIoTRuntimeLayer,
        Layer.provide(DeploymentModeTauriLayer),
        Layer.provide(TestRunner.layer),
      )),
    )
    await Effect.runPromise(program)
  })

  it('runtime layer with env-driven config defaults to test mode', async () => {
    const original = process.env['IIOT_DEPLOYMENT_MODE']
    delete process.env['IIOT_DEPLOYMENT_MODE']

    try {
      const program = Effect.void.pipe(
        Effect.provide(pipe(
          IIoTRuntimeLayer,
          Layer.provide(DeploymentModeEnvLayer),
          Layer.provide(TestRunner.layer),
        )),
      )
      await Effect.runPromise(program)
    } finally {
      if (original !== undefined) {
        process.env['IIOT_DEPLOYMENT_MODE'] = original
      }
    }
  })
})
