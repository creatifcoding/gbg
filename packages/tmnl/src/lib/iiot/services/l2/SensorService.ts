/**
 * SensorService - L2 Domain Service for Sensor Operations
 *
 * Business logic for sensor data:
 * - Reading ingestion and validation
 * - Time-series queries with aggregation
 * - Real-time streaming
 *
 * @module
 */

import { Effect, Stream, Chunk, Schedule } from 'effect'
import { Atom } from '@effect-atom/atom'
import type { DeviceId } from '../../schemas/identifiers'
import type {
  SensorReading,
  AggregatedReading,
  TimeBucket,
  QualityScore,
} from '../../schemas/readings'
import type { Sensor } from '../../schemas/assets'
import {
  DeviceNotFoundError,
  InvalidReadingError,
  IIoTQueryError,
  GraphQueryError,
} from '../../schemas/errors'
import { TimeSeriesClient } from '../l1/TimeSeriesClient'
import { AssetGraphQueries } from './AssetGraphQueries'

// =============================================================================
// Error Union
// =============================================================================

export type SensorServiceError =
  | DeviceNotFoundError
  | InvalidReadingError
  | IIoTQueryError
  | GraphQueryError

// =============================================================================
// Service Definition
// =============================================================================

export class SensorService extends Effect.Service<SensorService>()('iiot/SensorService', {
  dependencies: [TimeSeriesClient.Default, AssetGraphQueries.Default],

  scoped: Effect.gen(function* () {
    const tsClient = yield* TimeSeriesClient
    const assetGraph = yield* AssetGraphQueries

    // -------------------------------------------------------------------------
    // Atoms for reactive state
    // -------------------------------------------------------------------------

    /** Cache of latest readings per device */
    const latestReadingsAtom = Atom.make<Map<DeviceId, SensorReading>>(new Map())

    /** Active device subscriptions count */
    const activeSubscriptionsAtom = Atom.make<number>(0)

    // -------------------------------------------------------------------------
    // Core Operations
    // -------------------------------------------------------------------------

    /**
     * Ingest sensor readings in batch
     * Validates readings before insertion
     */
    const ingestReadings = (
      readings: ReadonlyArray<{
        time: Date
        deviceId: DeviceId
        value: number
        quality?: number
      }>
    ): Effect.Effect<number, InvalidReadingError | IIoTQueryError> =>
      Effect.gen(function* () {
        // Validate readings
        for (const reading of readings) {
          if (!Number.isFinite(reading.value)) {
            return yield* Effect.fail(
              new InvalidReadingError({
                deviceId: reading.deviceId,
                message: 'Value must be a finite number',
                value: reading.value,
              })
            )
          }
        }

        // Insert into TimescaleDB
        const inserted = yield* tsClient.insertReadings(
          readings.map((r) => ({
            ...r,
            quality: (r.quality ?? 100) as QualityScore,
          }))
        )

        yield* Effect.logInfo(`Ingested ${inserted} readings`)
        return inserted
      })

    /**
     * Query readings for a device with optional time range
     */
    const queryReadings = (params: {
      deviceId: DeviceId
      since?: Date
      until?: Date
      limit?: number
    }): Stream.Stream<SensorReading, IIoTQueryError> => tsClient.queryReadings(params)

    /**
     * Query aggregated readings from continuous aggregates
     */
    const queryAggregated = (params: {
      deviceId: DeviceId
      bucket: TimeBucket
      since?: Date
      until?: Date
    }): Stream.Stream<AggregatedReading, IIoTQueryError> => tsClient.queryAggregated(params)

    /**
     * Get the latest reading for a device
     */
    const getLatestReading = (
      deviceId: DeviceId
    ): Effect.Effect<SensorReading | null, IIoTQueryError> => tsClient.getLatestReading(deviceId)

    /**
     * Get all sensors registered in the system
     */
    const getAllSensors = (): Stream.Stream<Sensor, GraphQueryError> => assetGraph.getAllSensors()

    /**
     * Get sensors for a specific machine
     */
    const getSensorsForMachine = (
      machineId: string
    ): Stream.Stream<Sensor, GraphQueryError> =>
      assetGraph.getSensorsForMachine(machineId as any)

    /**
     * Subscribe to real-time readings for a device
     * Returns a Stream that emits new readings as they arrive
     */
    const subscribeToDevice = (
      deviceId: DeviceId,
      pollIntervalMs: number = 5000
    ): Stream.Stream<SensorReading, IIoTQueryError> =>
      Stream.repeatEffectWithSchedule(
        Effect.gen(function* () {
          const latest = yield* tsClient.getLatestReading(deviceId)
          return latest
        }),
        Schedule.spaced(pollIntervalMs)
      ).pipe(
        Stream.filter((reading): reading is SensorReading => reading !== null)
      )

    /**
     * Get statistics about sensor data
     */
    const getStats = (): Effect.Effect<
      {
        totalSensors: number
        hypertableStats: {
          tableName: string
          numChunks: number
          compressionEnabled: boolean
          totalSize: string
        }
      },
      IIoTQueryError | GraphQueryError
    > =>
      Effect.gen(function* () {
        const sensors = yield* assetGraph.getAllSensors().pipe(Stream.runCollect)
        const hypertable = yield* tsClient.getHypertableStats()

        return {
          totalSensors: Chunk.size(sensors),
          hypertableStats: hypertable,
        }
      })

    // -------------------------------------------------------------------------
    // Service API
    // -------------------------------------------------------------------------

    return {
      // Core operations
      ingestReadings,
      queryReadings,
      queryAggregated,
      getLatestReading,

      // Sensor discovery
      getAllSensors,
      getSensorsForMachine,

      // Real-time subscriptions
      subscribeToDevice,

      // Statistics
      getStats,

      // Atoms for reactive access
      latestReadingsAtom,
      activeSubscriptionsAtom,
    } as const
  }),
}) {}

// =============================================================================
// Exports
// =============================================================================

export const SensorServiceLive = SensorService.Default
