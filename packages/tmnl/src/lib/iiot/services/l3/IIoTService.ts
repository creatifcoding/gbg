/**
 * IIoTService - L3 Orchestration Layer
 *
 * High-level orchestration combining L2 domain services:
 * - Cross-domain operations (alarm + sensor + asset context)
 * - Dashboard aggregations
 * - Real-time monitoring workflows
 *
 * @module
 */

import { Effect, Stream, Chunk } from 'effect'
import type { DeviceId, PlantId, MachineId } from '../../schemas/identifiers'
import type { Alarm, AlarmSeverity } from '../../schemas/alarms'
import type { SensorReading, TimeBucket } from '../../schemas/readings'
import type { PlantHierarchy, SensorHierarchy } from '../../schemas/assets'
import { SensorService } from '../l2/SensorService'
import { AssetService } from '../l2/AssetService'
import { AlarmService } from '../l2/AlarmService'

// =============================================================================
// Orchestrated Result Types
// =============================================================================

/** Complete device context for dashboards */
export interface DeviceContext {
  readonly deviceId: DeviceId
  readonly hierarchy: SensorHierarchy
  readonly latestReading: SensorReading | null
  readonly activeAlarms: ReadonlyArray<Alarm>
}

/** Machine health summary */
export interface MachineHealth {
  readonly machineId: MachineId
  readonly machineName: string
  readonly sensorCount: number
  readonly activeAlarmCount: number
  readonly criticalAlarmCount: number
  readonly lastReadingTime: string | null
}

/** Plant overview for dashboards */
export interface PlantOverview {
  readonly plantId: PlantId
  readonly plantName: string
  readonly hierarchy: PlantHierarchy
  readonly alarmStats: {
    readonly total: number
    readonly open: number
    readonly critical: number
  }
  readonly sensorStats: {
    readonly total: number
    readonly withRecentData: number
  }
}

/** Alert with enriched context */
export interface EnrichedAlert {
  readonly alarm: Alarm
  readonly hierarchy: SensorHierarchy | null
  readonly recentReadings: ReadonlyArray<SensorReading>
}

// =============================================================================
// Service Definition
// =============================================================================

export class IIoTService extends Effect.Service<IIoTService>()('iiot/IIoTService', {
  dependencies: [SensorService.Default, AssetService.Default, AlarmService.Default],

  effect: Effect.gen(function* () {
    const sensorService = yield* SensorService
    const assetService = yield* AssetService
    const alarmService = yield* AlarmService

    // -------------------------------------------------------------------------
    // Device Operations
    // -------------------------------------------------------------------------

    /**
     * Get complete context for a device (hierarchy, readings, alarms)
     */
    const getDeviceContext = (
      deviceId: DeviceId
    ): Effect.Effect<DeviceContext, any> =>
      Effect.gen(function* () {
        // Parallel fetch of device info
        const [hierarchy, latestReading, alarmsChunk] = yield* Effect.all([
          assetService.getSensorHierarchy(deviceId),
          sensorService.getLatestReading(deviceId),
          alarmService.getAlarms({ deviceId, onlyOpen: true }).pipe(Stream.runCollect),
        ])

        return {
          deviceId,
          hierarchy,
          latestReading,
          activeAlarms: Chunk.toArray(alarmsChunk),
        }
      })

    /**
     * Get health summary for a machine
     */
    const getMachineHealth = (
      machineId: MachineId
    ): Effect.Effect<MachineHealth, any> =>
      Effect.gen(function* () {
        const { machine, sensors } = yield* assetService.getMachineWithSensors(machineId)

        // Get alarms for all sensors on this machine
        const alarmPromises = sensors.map((sensor) =>
          alarmService.getAlarms({ deviceId: sensor.deviceId, onlyOpen: true }).pipe(Stream.runCollect)
        )
        const alarmChunks = yield* Effect.all(alarmPromises)
        const allAlarms = alarmChunks.flatMap((chunk) => Chunk.toArray(chunk))

        // Get latest reading times
        const readingPromises = sensors.map((sensor) =>
          sensorService.getLatestReading(sensor.deviceId)
        )
        const readings = yield* Effect.all(readingPromises)
        const latestTime = readings
          .filter((r): r is SensorReading => r !== null)
          .sort((a, b) =>
            new Date(b.time as unknown as string).getTime() -
            new Date(a.time as unknown as string).getTime()
          )[0]

        return {
          machineId,
          machineName: machine.name,
          sensorCount: sensors.length,
          activeAlarmCount: allAlarms.length,
          criticalAlarmCount: allAlarms.filter(
            (a) => a.severity === 'critical' || a.severity === 'emergency'
          ).length,
          lastReadingTime: latestTime ? (latestTime.time as unknown as string) : null,
        }
      })

    // -------------------------------------------------------------------------
    // Plant Operations
    // -------------------------------------------------------------------------

    /**
     * Get plant overview with aggregated stats
     */
    const getPlantOverview = (
      plantId: PlantId
    ): Effect.Effect<PlantOverview, any> =>
      Effect.gen(function* () {
        // Get full hierarchy
        const hierarchy = yield* assetService.getPlantHierarchy(plantId)

        // Count all sensors
        const allSensors = hierarchy.lines.flatMap((line) =>
          line.machines.flatMap((machine) => machine.sensors)
        )

        // Get alarm stats
        const alarmStats = yield* alarmService.getStats()

        // Check which sensors have recent data (last hour)
        const recentThreshold = new Date(Date.now() - 60 * 60 * 1000)
        const readingChecks = yield* Effect.all(
          allSensors.slice(0, 100).map((sensor) => // Limit to avoid overwhelming
            sensorService.getLatestReading(sensor.deviceId).pipe(
              Effect.map((reading) =>
                reading !== null &&
                new Date(reading.time as unknown as string) > recentThreshold
              ),
              Effect.catchAll(() => Effect.succeed(false))
            )
          )
        )
        const sensorsWithRecentData = readingChecks.filter(Boolean).length

        return {
          plantId,
          plantName: hierarchy.plant.name,
          hierarchy,
          alarmStats: {
            total: alarmStats.total,
            open: alarmStats.open,
            critical: alarmStats.bySeverity.critical + alarmStats.bySeverity.emergency,
          },
          sensorStats: {
            total: allSensors.length,
            withRecentData: sensorsWithRecentData,
          },
        }
      })

    // -------------------------------------------------------------------------
    // Alert Operations
    // -------------------------------------------------------------------------

    /**
     * Get enriched alerts with context
     */
    const getEnrichedAlerts = (params?: {
      severity?: AlarmSeverity
      onlyOpen?: boolean
      limit?: number
    }): Stream.Stream<EnrichedAlert, any> =>
      alarmService.getAlarms({
        severity: params?.severity,
        onlyOpen: params?.onlyOpen ?? true,
      }).pipe(
        Stream.take(params?.limit ?? 50),
        Stream.mapEffect((alarm) =>
          Effect.gen(function* () {
            // Get hierarchy (may fail if sensor not found)
            const hierarchy = yield* assetService
              .getSensorHierarchy(alarm.deviceId)
              .pipe(Effect.option)

            // Get recent readings around alarm time
            const alarmTime = new Date(alarm.triggeredAt as unknown as string)
            const since = new Date(alarmTime.getTime() - 5 * 60 * 1000)
            const until = new Date(alarmTime.getTime() + 5 * 60 * 1000)

            const readingsChunk = yield* sensorService
              .queryReadings({
                deviceId: alarm.deviceId,
                since,
                until,
                limit: 20,
              })
              .pipe(Stream.runCollect)

            return {
              alarm,
              hierarchy: hierarchy._tag === 'Some' ? hierarchy.value : null,
              recentReadings: Chunk.toArray(readingsChunk),
            }
          })
        )
      )

    /**
     * Create an alarm with automatic context enrichment
     */
    const raiseAlarm = (params: {
      deviceId: DeviceId
      alarmType: string
      severity: AlarmSeverity
      message: string
    }): Effect.Effect<EnrichedAlert, any> =>
      Effect.gen(function* () {
        // Create the alarm
        const alarm = yield* alarmService.createAlarm({
          deviceId: params.deviceId,
          alarmType: params.alarmType as any,
          severity: params.severity,
          message: params.message,
        })

        // Enrich with context
        const hierarchy = yield* assetService
          .getSensorHierarchy(params.deviceId)
          .pipe(Effect.option)

        const readingsChunk = yield* sensorService
          .queryReadings({
            deviceId: params.deviceId,
            limit: 10,
          })
          .pipe(Stream.runCollect)

        yield* Effect.logWarning(
          `ALARM RAISED: ${params.severity} - ${params.message} on device ${params.deviceId}`
        )

        return {
          alarm,
          hierarchy: hierarchy._tag === 'Some' ? hierarchy.value : null,
          recentReadings: Chunk.toArray(readingsChunk),
        }
      })

    // -------------------------------------------------------------------------
    // Monitoring Workflows
    // -------------------------------------------------------------------------

    /**
     * Subscribe to a device with automatic alarm generation
     * when thresholds are exceeded
     */
    const monitorDevice = (params: {
      deviceId: DeviceId
      thresholds: {
        warning?: number
        critical?: number
      }
      pollIntervalMs?: number
    }): Stream.Stream<SensorReading | EnrichedAlert, any> =>
      sensorService.subscribeToDevice(params.deviceId, params.pollIntervalMs).pipe(
        Stream.mapEffect((reading) =>
          Effect.gen(function* () {
            // Check thresholds
            if (params.thresholds.critical && reading.value > params.thresholds.critical) {
              const alert = yield* raiseAlarm({
                deviceId: params.deviceId,
                alarmType: 'threshold_exceeded',
                severity: 'critical',
                message: `Value ${reading.value} exceeds critical threshold ${params.thresholds.critical}`,
              })
              return alert as SensorReading | EnrichedAlert
            }

            if (params.thresholds.warning && reading.value > params.thresholds.warning) {
              const alert = yield* raiseAlarm({
                deviceId: params.deviceId,
                alarmType: 'threshold_exceeded',
                severity: 'warning',
                message: `Value ${reading.value} exceeds warning threshold ${params.thresholds.warning}`,
              })
              return alert as SensorReading | EnrichedAlert
            }

            return reading as SensorReading | EnrichedAlert
          })
        )
      )

    /**
     * Get aggregated trends for multiple devices
     */
    const getDeviceTrends = (params: {
      deviceIds: ReadonlyArray<DeviceId>
      bucket: TimeBucket
      since?: Date
      until?: Date
    }): Effect.Effect<
      Map<DeviceId, ReadonlyArray<{ bucket: string; avg: number; min: number; max: number }>>,
      any
    > =>
      Effect.gen(function* () {
        const results = new Map<DeviceId, ReadonlyArray<{ bucket: string; avg: number; min: number; max: number }>>()

        for (const deviceId of params.deviceIds) {
          const aggregated = yield* sensorService
            .queryAggregated({
              deviceId,
              bucket: params.bucket,
              since: params.since,
              until: params.until,
            })
            .pipe(Stream.runCollect)

          results.set(
            deviceId,
            Chunk.toArray(aggregated).map((r) => ({
              bucket: r.bucket as unknown as string,
              avg: r.avgValue,
              min: r.minValue,
              max: r.maxValue,
            }))
          )
        }

        return results
      })

    // -------------------------------------------------------------------------
    // Service API
    // -------------------------------------------------------------------------

    return {
      // Device operations
      getDeviceContext,
      getMachineHealth,

      // Plant operations
      getPlantOverview,

      // Alert operations
      getEnrichedAlerts,
      raiseAlarm,

      // Monitoring workflows
      monitorDevice,
      getDeviceTrends,

      // Expose underlying services for direct access
      sensors: sensorService,
      assets: assetService,
      alarms: alarmService,
    } as const
  }),
}) {}

// =============================================================================
// Exports
// =============================================================================

export const IIoTServiceLive = IIoTService.Default
