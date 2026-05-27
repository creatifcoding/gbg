/** Alarm graph query/projection service built on generic GraphClient primitives. */

import { Effect, Stream } from 'effect'
import type { AlarmId, DeviceId, MachineId } from '../../schemas/identifiers'
import type { MeasurementUnit, Sensor, SensorType } from '../../schemas/assets'
import { GraphQueryError } from '../../schemas/errors'
import {
  RELATIONSHIP_EDGE_REGISTRY,
  RelationshipEdgeMetadata,
  RelationshipEdges,
  RelationshipEndpoints,
} from '../../schemas/relationships'
import { GraphClient } from '../l1/GraphClient'

const escapeCypher = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export class AlarmGraphQueries extends Effect.Service<AlarmGraphQueries>()('iiot/AlarmGraphQueries', {
  dependencies: [GraphClient.Default],
  effect: Effect.gen(function* () {
    const graph = yield* GraphClient

    const createAlarmNode = (alarm: {
      readonly id: AlarmId | string
      readonly alarmType: string
      readonly severity: string
      readonly message?: string
      readonly timestamp: Date
    }): Effect.Effect<void, GraphQueryError> =>
      graph.upsertRelationshipNode(RelationshipEndpoints.alarm(String(alarm.id)), {
        alarm_type: alarm.alarmType,
        severity: alarm.severity,
        message: alarm.message ?? '',
        timestamp: alarm.timestamp.toISOString(),
      })

    const linkAlarmToSensor = (
      alarmId: AlarmId | string,
      deviceId: DeviceId,
    ): Effect.Effect<void, GraphQueryError> =>
      graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.triggered_by,
        RelationshipEndpoints.alarm(String(alarmId)),
        RelationshipEndpoints.sensor(deviceId),
        new RelationshipEdgeMetadata({
          createdBy: 'system',
          reason: 'alarm_triggered_by_sensor',
        }),
      ))

    const getSensorsWithAlarms = (
      since?: Date,
    ): Stream.Stream<{ sensor: Sensor; alarmCount: number }, GraphQueryError> =>
      Stream.fromEffect(
        Effect.gen(function* () {
          const sinceStr = since?.toISOString() ?? new Date(0).toISOString()
          const result = yield* graph.executeReadOnlyCypher(
            `MATCH (a:alarm)-[:triggered_by]->(s:sensor)-[:monitors]->(m:machine)
             WHERE a.timestamp >= '${escapeCypher(sinceStr)}'
             RETURN s.device_id AS device_id, s.type AS type, s.unit AS unit,
                    m.id AS machine_id, COUNT(a) AS alarm_count`,
            '(device_id agtype, type agtype, unit agtype, machine_id agtype, alarm_count agtype)',
          )

          return result.rows.map((row) => ({
            sensor: {
              _tag: 'Sensor' as const,
              deviceId: String(row['deviceId']) as DeviceId,
              type: String(row['type']) as SensorType,
              unit: String(row['unit']) as MeasurementUnit,
              machineId: String(row['machineId']) as MachineId,
            } as Sensor,
            alarmCount: Number(row['alarmCount']),
          }))
        }),
      ).pipe(Stream.flatMap((items) => Stream.fromIterable(items)))

    return {
      createAlarmNode,
      linkAlarmToSensor,
      getSensorsWithAlarms,
    } as const
  }),
}) {}

export const AlarmGraphQueriesLive = AlarmGraphQueries.Default
