/**
 * Machine Integration Test Layer
 *
 * Provides test layers for Effect Machine integration tests.
 * Combines SQL-backed state services with real PostgreSQL for full integration testing.
 *
 * Architecture:
 * - State services: SQL-backed via repos (verifies real persistence)
 * - EventJournal: Real PostgreSQL (verifies event persistence)
 * - Feature flags: Configurable (enable/disable event emission)
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * @module
 */

import { Effect, Layer, Option, DateTime } from 'effect'
import { PgClient } from '@effect/sql-pg'

// Base integration layer
import {
  TestPgClientWithMigrations,
  EventJournalIntegrationLayer,
  cleanAllTestData,
  setupTestHierarchy,
  isDatabaseAvailable,
} from '../layer'

// State service tags and SQL factories
import { AlarmState, makeAlarmStateSql } from '../../../state/AlarmState'
import { WorkOrderState, makeWorkOrderStateSql } from '../../../state/WorkOrderState'
import { EquipmentStateService, makeEquipmentStateSql } from '../../../state/EquipmentStateService'

// Domain types for model-to-domain conversion
import { Alarm, type CreateAlarmParams } from '../../../schemas/alarms'
import { WorkOrder } from '../../../schemas/work-orders'
import { EquipmentState } from '../../../schemas/equipment-state/schema'

// Repositories
import {
  AlarmRepo,
  AlarmRepoLive,
  WorkOrderRepo,
  WorkOrderRepoLive,
  EquipmentStateRepo,
  EquipmentStateRepoLive,
  WorkOrderTransitionRepoLive,
} from '../../../repos'

// Feature flags
import {
  IIoTFeatureFlagsEnabledLayer,
  IIoTFeatureFlagsDisabledLayer,
  makeFeatureFlagsLayer,
} from '../../../infrastructure/feature-flags'

// =============================================================================
// Cleanup Utilities
// =============================================================================

/**
 * Clean up test data for machine integration tests.
 *
 * Order matters due to foreign key constraints:
 * 1. event_journal (no external FKs)
 * 2. work_order_transitions (FK to work_orders)
 * 3. work_orders (self-referencing FK)
 * 4. equipment_states (FK to machines)
 * 5. alarms
 * 6. assets hierarchy
 */
export const cleanMachineTestData = cleanAllTestData

/**
 * Setup required parent entities for FK constraints.
 * Creates test hierarchy: Enterprise → Site → Area
 */
export const setupMachineTestHierarchy = setupTestHierarchy

/**
 * Clean up work order transitions for a specific work order.
 */
export const cleanWorkOrderTransitions = (workOrderId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    yield* sql`DELETE FROM iiot.work_order_transitions WHERE work_order_id = ${workOrderId}`.pipe(
      Effect.orElseSucceed(() => undefined)
    )
  })

// =============================================================================
// Repository Layers
// =============================================================================

/**
 * Work order transition repository layer using test database.
 * Used for FDA audit trail verification.
 */
const WorkOrderTransitionRepoTestLayer = WorkOrderTransitionRepoLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

// =============================================================================
// SQL-Backed State Service Layers
// =============================================================================

// Helper: Convert Option<Date> to Option<DateTime.Utc>
const optDateToUtc = (opt: Option.Option<Date>): Option.Option<DateTime.Utc> =>
  Option.map(opt, DateTime.unsafeFromDate)

/**
 * SQL-backed AlarmState layer for integration tests.
 *
 * Bridges AlarmRepo (Model types) to AlarmState (Domain types).
 * The AlarmModel lacks `state` and `assetId` fields, so we derive them:
 * - state: derived from acknowledgedAt/clearedAt presence
 * - assetId: not tracked at repo level, left undefined
 */
const AlarmStateSqlTestLayer = Layer.effect(
  AlarmState,
  Effect.gen(function* () {
    const repo = yield* AlarmRepo

    const alarmModelToDomain = (m: any): Alarm =>
      new Alarm({
        id: m.id,
        deviceId: m.deviceId,
        alarmType: m.alarmType,
        severity: m.severity,
        state: (Option.isSome(m.clearedAt)
          ? 'cleared'
          : Option.isSome(m.acknowledgedAt)
            ? 'acknowledged'
            : 'unacknowledged') as any,
        message: Option.isSome(m.message) ? m.message.value : undefined,
        triggeredAt: m.triggeredAt,
        acknowledgedAt: Option.isSome(m.acknowledgedAt)
          ? DateTime.unsafeFromDate(m.acknowledgedAt.value)
          : undefined,
        acknowledgedBy: Option.isSome(m.acknowledgedBy)
          ? m.acknowledgedBy.value
          : undefined,
        clearedAt: Option.isSome(m.clearedAt)
          ? DateTime.unsafeFromDate(m.clearedAt.value)
          : undefined,
        metadata: Option.isSome(m.metadata) ? m.metadata.value : undefined,
      })

    return makeAlarmStateSql({
      findById: (id) =>
        repo.findById(id).pipe(
          Effect.map(Option.map(alarmModelToDomain))
        ),

      findAll: (filter) =>
        repo.query({
          deviceId: filter.deviceId as any,
          severity: filter.severity as any,
          onlyOpen: filter.onlyActive,
          since: filter.since,
          limit: filter.limit,
        }).pipe(Effect.map((rows) => rows.map(alarmModelToDomain))),

      insert: (alarm) =>
        repo.insert({
          deviceId: alarm.deviceId,
          alarmType: alarm.alarmType,
          severity: alarm.severity,
          message: alarm.message ? Option.some(alarm.message) : Option.none(),
          metadata: alarm.metadata ? Option.some(alarm.metadata as any) : Option.none(),
        } as any).pipe(Effect.map(alarmModelToDomain)),

      update: (alarm) => {
        // Check clearedAt FIRST (cleared alarms also have acknowledgedAt)
        if (alarm.clearedAt) {
          return repo.clear(alarm.id).pipe(
            Effect.map(alarmModelToDomain)
          )
        }
        if (alarm.acknowledgedAt && alarm.acknowledgedBy) {
          return repo.acknowledge(alarm.id, alarm.acknowledgedBy).pipe(
            Effect.map(alarmModelToDomain)
          )
        }
        // Generic update for other fields (severity, message)
        return repo.update({
          id: alarm.id,
          severity: alarm.severity,
          message: alarm.message ? Option.some(alarm.message) : undefined,
        } as any).pipe(Effect.map(alarmModelToDomain))
      },

      delete: (id) =>
        repo.delete(id).pipe(Effect.map(() => true)),

      insertWithGeneratedId: (params: CreateAlarmParams) =>
        repo.insert({
          deviceId: params.deviceId,
          alarmType: params.alarmType,
          severity: params.severity,
          message: params.message ? Option.some(params.message) : Option.none(),
          metadata: params.metadata ? Option.some(params.metadata as any) : Option.none(),
        } as any).pipe(Effect.map(alarmModelToDomain)),
    })
  })
).pipe(
  Layer.provide(AlarmRepoLive),
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * SQL-backed WorkOrderState layer for integration tests.
 *
 * Bridges WorkOrderRepo (Model types) to WorkOrderState (Domain types).
 */
const WorkOrderStateSqlTestLayer = Layer.effect(
  WorkOrderState,
  Effect.gen(function* () {
    const repo = yield* WorkOrderRepo

    const workOrderModelToDomain = (m: any): WorkOrder =>
      new WorkOrder({
        id: m.id,
        workflowDefinitionId: m.workflowDefinitionId,
        workflowVersion: m.workflowVersion,
        title: m.title,
        description: m.description,
        type: m.type,
        priority: m.priority,
        status: m.status,
        createdBy: m.createdBy,
        createdAt: m.createdAt,
        scheduledStart: optDateToUtc(m.scheduledStart),
        dueDate: optDateToUtc(m.dueDate),
        actualStart: optDateToUtc(m.actualStart),
        actualEnd: optDateToUtc(m.actualEnd),
        parentWorkOrderId: m.parentWorkOrderId,
        primaryAssetId: m.primaryAssetId,
        assignedTo: m.assignedTo,
        outcome: m.outcome,
        summary: m.summary,
        failedTaskId: m.failedTaskId,
        failureReason: m.failureReason,
        suspensionReason: m.suspensionReason,
        expectedResume: optDateToUtc(m.expectedResume),
        cancellationReason: m.cancellationReason,
        finalStatus: m.finalStatus,
        metadata: Option.isSome(m.metadata) ? m.metadata.value : {},
      })

    return makeWorkOrderStateSql({
      findById: (id) =>
        repo.findById(id).pipe(
          Effect.map(Option.map(workOrderModelToDomain))
        ),

      findAll: (filter) =>
        repo.query({
          status: filter.status?.[0] as any,
          type: filter.type?.[0] as any,
          priority: filter.priority?.[0] as any,
          assignedTo: filter.assignedTo,
          primaryAssetId: filter.primaryAssetId as any,
          since: filter.since,
          limit: filter.limit,
        }).pipe(Effect.map((rows) => rows.map(workOrderModelToDomain))),

      insert: (wo) =>
        repo.insert({
          workflowDefinitionId: wo.workflowDefinitionId,
          workflowVersion: wo.workflowVersion,
          title: wo.title,
          description: wo.description,
          type: wo.type,
          priority: wo.priority,
          status: wo.status,
          createdBy: wo.createdBy,
          scheduledStart: Option.flatMap(wo.scheduledStart, (dt) =>
            Option.some(new Date(Number(dt.epochMillis)))
          ),
          dueDate: Option.flatMap(wo.dueDate, (dt) =>
            Option.some(new Date(Number(dt.epochMillis)))
          ),
          parentWorkOrderId: wo.parentWorkOrderId,
          primaryAssetId: wo.primaryAssetId,
          assignedTo: wo.assignedTo,
          metadata: wo.metadata ? Option.some(wo.metadata as any) : Option.none(),
        } as any).pipe(Effect.map(workOrderModelToDomain)),

      update: (wo) =>
        repo.update({
          id: wo.id,
          status: wo.status,
          summary: wo.summary !== undefined ? wo.summary : undefined,
        } as any).pipe(Effect.map(workOrderModelToDomain)),

      delete: (id) =>
        repo.delete(id).pipe(Effect.map(() => true)),
    })
  })
).pipe(
  Layer.provide(WorkOrderRepoLive),
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * SQL-backed EquipmentStateService layer for integration tests.
 *
 * Bridges EquipmentStateRepo (Model types) to EquipmentStateService (Domain types).
 */
const EquipmentStateServiceSqlTestLayer = Layer.effect(
  EquipmentStateService,
  Effect.gen(function* () {
    const repo = yield* EquipmentStateRepo

    const equipmentStateModelToDomain = (m: any): EquipmentState =>
      new EquipmentState({
        id: m.id,
        machineId: m.machineId,
        state: m.state,
        reason: m.reason,
        startedAt: m.startedAt,
        endedAt: optDateToUtc(m.endedAt),
        operatorId: m.operatorId,
        notes: m.notes,
        metadata: Option.isSome(m.metadata) ? m.metadata.value : {},
      })

    return makeEquipmentStateSql({
      findById: (id) =>
        repo.findById(id).pipe(
          Effect.map(Option.map(equipmentStateModelToDomain))
        ),

      findByMachine: (machineId, filter) =>
        repo.query({
          machineId,
          state: filter.state as any,
          onlyActive: filter.onlyActive,
          since: filter.since,
          until: filter.until,
          limit: filter.limit,
        }).pipe(
          Effect.map((rows) => rows.map(equipmentStateModelToDomain))
        ),

      findActive: (machineId) =>
        repo.query({ machineId, onlyActive: true, limit: 1 }).pipe(
          Effect.map((rows) =>
            rows.length > 0
              ? Option.some(equipmentStateModelToDomain(rows[0]))
              : Option.none()
          )
        ),

      insert: (state) =>
        repo.insert({
          machineId: state.machineId,
          state: state.state,
          reason: state.reason,
          operatorId: state.operatorId,
          notes: state.notes,
          metadata: state.metadata ? Option.some(state.metadata as any) : Option.none(),
        } as any).pipe(Effect.map(equipmentStateModelToDomain)),

      update: (state) =>
        repo.update({
          id: state.id,
          state: state.state,
          reason: state.reason !== undefined ? state.reason : undefined,
        } as any).pipe(Effect.map(equipmentStateModelToDomain)),

      endState: (id, endedAt) =>
        repo.endState(id, endedAt).pipe(Effect.map(() => true)),

      delete: (id) =>
        repo.delete(id).pipe(Effect.map(() => true)),
    })
  })
).pipe(
  Layer.provide(EquipmentStateRepoLive),
  Layer.provide(TestPgClientWithMigrations)
)

// =============================================================================
// Combined Machine Test Layers
// =============================================================================

/**
 * AlarmMachine integration test layer.
 *
 * Provides:
 * - PgClient (real PostgreSQL)
 * - AlarmState (SQL-backed)
 * - IIoTFeatureFlags (all enabled)
 * - EventJournal (SQL-backed)
 * - Migrations (auto-run)
 */
export const AlarmMachineIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  AlarmStateSqlTestLayer,
  IIoTFeatureFlagsEnabledLayer,
  EventJournalIntegrationLayer
)

/**
 * AlarmMachine integration test layer with events DISABLED.
 * Use for testing CRUD-only behavior.
 */
export const AlarmMachineIntegrationLayerNoEvents = Layer.mergeAll(
  TestPgClientWithMigrations,
  AlarmStateSqlTestLayer,
  IIoTFeatureFlagsDisabledLayer,
  EventJournalIntegrationLayer
)

/**
 * WorkOrderMachine integration test layer.
 *
 * Provides:
 * - PgClient (real PostgreSQL)
 * - SqlClient (for transactions)
 * - WorkOrderState (SQL-backed)
 * - WorkOrderTransitionRepo (for FDA audit trail)
 * - IIoTFeatureFlags (all enabled)
 * - EventJournal (SQL-backed)
 * - Migrations (auto-run)
 */
export const WorkOrderMachineIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  WorkOrderStateSqlTestLayer,
  WorkOrderTransitionRepoTestLayer,
  IIoTFeatureFlagsEnabledLayer,
  EventJournalIntegrationLayer
)

/**
 * WorkOrderMachine integration test layer with events DISABLED.
 */
export const WorkOrderMachineIntegrationLayerNoEvents = Layer.mergeAll(
  TestPgClientWithMigrations,
  WorkOrderStateSqlTestLayer,
  WorkOrderTransitionRepoTestLayer,
  IIoTFeatureFlagsDisabledLayer,
  EventJournalIntegrationLayer
)

/**
 * EquipmentStateMachine integration test layer.
 *
 * Provides:
 * - PgClient (real PostgreSQL)
 * - EquipmentStateService (SQL-backed)
 * - IIoTFeatureFlags (all enabled)
 * - EventJournal (SQL-backed)
 * - Migrations (auto-run)
 */
export const EquipmentStateMachineIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  EquipmentStateServiceSqlTestLayer,
  IIoTFeatureFlagsEnabledLayer,
  EventJournalIntegrationLayer
)

/**
 * EquipmentStateMachine integration test layer with events DISABLED.
 */
export const EquipmentStateMachineIntegrationLayerNoEvents = Layer.mergeAll(
  TestPgClientWithMigrations,
  EquipmentStateServiceSqlTestLayer,
  IIoTFeatureFlagsDisabledLayer,
  EventJournalIntegrationLayer
)

/**
 * Full machine integration test layer with all services.
 *
 * Provides all machine state services, repos, and feature flags.
 */
export const FullMachineIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  AlarmStateSqlTestLayer,
  WorkOrderStateSqlTestLayer,
  WorkOrderTransitionRepoTestLayer,
  EquipmentStateServiceSqlTestLayer,
  IIoTFeatureFlagsEnabledLayer,
  EventJournalIntegrationLayer
)

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Wrapper to run machine test with clean database state.
 *
 * Cleans test data before and after test execution.
 * Also sets up required hierarchy (Enterprise, Site, Area).
 */
export const withCleanMachineDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanMachineTestData
    yield* setupMachineTestHierarchy
    const result = yield* test
    yield* cleanMachineTestData
    return result
  })

/**
 * Create a custom feature flags layer for specific test scenarios.
 *
 * @example
 * ```typescript
 * const TestFlagsLayer = makeTestFeatureFlags({
 *   alarmEventSourcingEnabled: true,
 *   workOrderEventSourcingEnabled: false,
 * })
 * ```
 */
export const makeTestFeatureFlags = makeFeatureFlagsLayer

/**
 * Re-export isDatabaseAvailable for test skip logic.
 */
export { isDatabaseAvailable }

/**
 * Skip test if database is not available.
 *
 * Usage:
 * ```typescript
 * it.effect('test name', () =>
 *   skipMachineTestIfNoDb(
 *     Effect.gen(function* () {
 *       // Test code
 *     })
 *   )
 * )
 * ```
 */
export const skipMachineTestIfNoDb = <A, E, R>(
  test: Effect.Effect<A, E, R>
): Effect.Effect<A | undefined, E, R | PgClient.PgClient> =>
  Effect.gen(function* () {
    const available = yield* isDatabaseAvailable
    if (!available) {
      yield* Effect.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
      return undefined
    }
    return yield* test
  })

// =============================================================================
// Test Fixture Helpers
// =============================================================================

/**
 * Create a test machine for equipment state tests.
 */
export const setupTestMachine = (machineId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient

    // Create parent plant and line first
    yield* sql.unsafe(`
      INSERT INTO iiot.plants (id, name, status, timezone, hierarchy_path, enterprise_id, site_id)
      VALUES ('TEST-PLT-001', 'Test Plant', 'active', 'UTC', '/TEST-ENT-001/TEST-SIT-001/TEST-PLT-001', 'TEST-ENT-001', 'TEST-SIT-001')
      ON CONFLICT (id) DO NOTHING
    `)

    yield* sql.unsafe(`
      INSERT INTO iiot.lines (id, name, status, hierarchy_path, enterprise_id, site_id, plant_id)
      VALUES ('TEST-LIN-001', 'Test Line', 'active', '/TEST-ENT-001/TEST-SIT-001/TEST-PLT-001/TEST-LIN-001', 'TEST-ENT-001', 'TEST-SIT-001', 'TEST-PLT-001')
      ON CONFLICT (id) DO NOTHING
    `)

    // Create the test machine
    yield* sql.unsafe(`
      INSERT INTO iiot.machines (id, name, status, hierarchy_path, enterprise_id, site_id, plant_id, line_id, machine_type)
      VALUES ('${machineId}', 'Test Machine', 'active', '/TEST-ENT-001/TEST-SIT-001/TEST-PLT-001/TEST-LIN-001/${machineId}', 'TEST-ENT-001', 'TEST-SIT-001', 'TEST-PLT-001', 'TEST-LIN-001', 'general')
      ON CONFLICT (id) DO NOTHING
    `)

    yield* Effect.log(`Setup test machine: ${machineId}`)
  })

/**
 * Create a test sensor for alarm tests.
 */
export const setupTestSensor = (sensorId: string, machineId: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient

    yield* sql.unsafe(`
      INSERT INTO iiot.sensors (device_id, name, status, type, unit, hierarchy_path, enterprise_id, site_id, plant_id, line_id, machine_id)
      VALUES ('${sensorId}', 'Test Sensor', 'active', 'temperature', 'celsius',
              '/TEST-ENT-001/TEST-SIT-001/TEST-PLT-001/TEST-LIN-001/${machineId}/${sensorId}',
              'TEST-ENT-001', 'TEST-SIT-001', 'TEST-PLT-001', 'TEST-LIN-001', '${machineId}')
      ON CONFLICT (device_id) DO NOTHING
    `)

    yield* Effect.log(`Setup test sensor: ${sensorId}`)
  })

// =============================================================================
// Test ID Generator
// =============================================================================

let testIdCounter = 0

/**
 * Generate unique test IDs with TEST- prefix.
 */
export const makeTestId = (prefix: string): string =>
  `TEST-${prefix}-${Date.now()}-${++testIdCounter}`
