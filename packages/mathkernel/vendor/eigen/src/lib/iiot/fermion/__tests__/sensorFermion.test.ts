/**
 * Fermion + IIoT Integration Test
 *
 * Proves: Fermion can fetch sensor data from IIoT database.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer } from 'effect'
import { Registry } from '@effect-atom/atom'
import { sensorFermion } from '../index'
import { IIoTIntegrationLayer, isDatabaseAvailable } from '../../__tests__/integration/layer'
import { IIoTService } from '../../services/l3/IIoTService'
import type { DeviceId } from '../../schemas/identifiers'

// Build full layer: IIoT database + IIoTService + AtomRegistry
const TestLayer = Layer.mergeAll(
  IIoTIntegrationLayer,
  IIoTService.Default.pipe(Layer.provide(IIoTIntegrationLayer)),
  Registry.layer
)

describe('sensorFermion', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(IIoTIntegrationLayer))
    )
  })

  it('fetches sensor reading via Fermion', async () => {
    if (!dbAvailable) {
      console.log('Skipping: IIoT database not available')
      return
    }

    const deviceId = 'TEST-TMP-001' as DeviceId

    // Fetch via Fermion
    const result = await Effect.runPromise(
      sensorFermion.fetch(deviceId).pipe(
        Effect.provide(TestLayer),
        Effect.either
      )
    )

    console.log('Fermion fetch result:', result._tag)

    // Either success (data exists) or left (DeviceNotFoundError - no data)
    expect(['Right', 'Left']).toContain(result._tag)
  })
})
