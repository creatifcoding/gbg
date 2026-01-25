/**
 * IIoT + Fermion Integration
 *
 * Minimal vertical slice: Fermion family that fetches sensor data from IIoT.
 */

import { Effect } from 'effect'
import * as Fermion from '../../fermion'
import { IIoTService } from '../services/l3/IIoTService'
import { SensorReading } from '../schemas/readings'
import { DeviceNotFoundError } from '../schemas/errors'

/**
 * Sensor Fermion Family
 *
 * Schema-driven atom family keyed by deviceId.
 *
 * Usage:
 *   const atom = sensorFermion('TMP-001')     // Get atom
 *   await sensorFermion.fetch('TMP-001')      // Fetch & populate
 */
export const sensorFermion = Fermion.fromSchema(SensorReading)
  .withKey('deviceId')
  .withFetch((deviceId) =>
    Effect.gen(function* () {
      const iiot = yield* IIoTService
      const reading = yield* iiot.sensors.getLatestReading(deviceId)
      if (!reading) {
        return yield* Effect.fail(new DeviceNotFoundError({ deviceId }))
      }
      return reading
    })
  )
  .buildWithDeps()
