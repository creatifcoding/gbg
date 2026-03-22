/**
 * IIoT Deployment Profile Layers
 *
 * Pre-composed Layer stacks for different deployment scenarios:
 *
 * - `IIoTTestLayer` — All state services in-memory, events disabled.
 *   For unit tests and integration tests without persistence.
 *
 * - `IIoTClusterLayer` — Entity handlers with events enabled.
 *   Requires SQL-backed state services to be provided externally.
 *   For production cluster deployment with PostgreSQL + NATS.
 *
 * - `IIoTRuntimeLayer` — Config-driven layer selection via DeploymentModeConfig.
 *   Reads deployment mode and selects the appropriate stack.
 *
 * Architecture:
 * ```
 *   IIoTTestLayer
 *     ├─ EntityHandlersLayer (12 entity handlers)
 *     ├─ AllStateServicesInMemory (12 in-memory state services)
 *     └─ IIoTFeatureFlagsDisabledLayer
 *
 *   IIoTClusterLayer
 *     ├─ EntityHandlersLayer (12 entity handlers)
 *     ├─ IIoTFeatureFlagsEnabledLayer
 *     └─ [requires: AllStateServicesSql or equivalent]
 *
 *   IIoTRuntimeLayer
 *     ├─ DeploymentModeConfig → selects:
 *     │   ├─ 'test' → IIoTTestLayer
 *     │   ├─ 'tauri' → IIoTTauriLayer (future)
 *     │   └─ 'cluster' → IIoTClusterLayer
 *     └─ [requires: DeploymentModeConfig]
 * ```
 *
 * Model→Schema Bridge Note:
 * SQL state layers require bridging @effect/sql Model types (from repos)
 * to Effect Schema types (consumed by entity handlers/machines).
 * Key differences: Model.Class encodes for SQL (Date, string enums),
 * while Schema.TaggedClass encodes for domain (DateTime.Utc, HierarchyPath).
 * See `AllStateServicesSql` for the adapter pattern.
 *
 * @module @gbg/tmnl/iiot/layers
 */

import { Layer, Effect, Option, pipe } from 'effect'
import {
  EntityTestingStack,
  EntityProductionHandlersWithEvents,
} from '../entity/EntityStack'
import {
  AlarmState,
  WorkOrderState,
  EquipmentStateService,
  MachineState,
  AreaState,
  SensorAssetState,
  PlantState,
  EnterpriseState,
  SiteState,
  WorkCellState,
  LineState,
  DeviceState,
  makeAlarmStateSql,
  makeWorkOrderStateSql,
  makeEquipmentStateSql,
  makeMachineStateSql,
  makeAreaStateSql,
  makeSensorAssetStateSql,
  makePlantStateSql,
  makeEnterpriseStateSql,
  makeSiteStateSql,
  makeWorkCellStateSql,
  makeLineStateSql,
  makeDeviceStateSql,
} from '../state'
import { DeploymentModeConfig } from '../infrastructure/deployment-mode'
import {
  IIoTRepositoriesLive,
  AlarmRepo,
  SiteRepo,
  AreaRepo,
  PlantRepo,
  LineRepo,
  WorkCellRepo,
  MachineRepo,
  SensorRepo,
  DeviceRepo,
  EnterpriseRepo,
  EquipmentStateRepo,
  WorkOrderRepo,
} from '../repos'

// =============================================================================
// Test Layer (In-Memory)
// =============================================================================

/**
 * Complete IIoT testing stack with in-memory state services.
 *
 * Self-contained — no external dependencies required.
 *
 * Provides:
 * - 12 entity handlers (Alarm, WorkOrder, Equipment, Site, Area, etc.)
 * - 12 in-memory state services
 * - Feature flags disabled (no EventLog integration)
 *
 * Usage:
 * ```ts
 * const result = await Effect.runPromise(
 *   program.pipe(Effect.provide(IIoTTestLayer))
 * )
 * ```
 */
export const IIoTTestLayer = EntityTestingStack

// =============================================================================
// SQL State Service Adapters
// =============================================================================

/**
 * SQL-backed state services bridging repos to state service interfaces.
 *
 * Each adapter resolves its repo tag, creates a state service using
 * the `make*StateSql` factory, and provides the state service tag.
 *
 * TYPE SAFETY NOTE:
 * The SQL factories accept Schema types (e.g., `Alarm`) but repos return
 * Model types (e.g., `AlarmModel`). These are structurally compatible at
 * runtime for CRUD pass-through operations. Type assertions (`as any`)
 * are used at the adapter boundary because:
 *
 * 1. SQL factories don't call Schema class methods
 * 2. Pass-through operations (findById, insert, update, delete) work
 *    with the structural overlap between Model and Schema types
 * 3. Entity handlers access state through Machines, which reconstruct
 *    Schema instances for state transitions (in-memory path)
 *
 * For production cluster deployment, Model classes should be updated
 * to use domain-specific status enums matching their Schema counterparts.
 *
 * Requires: IIoTRepositoriesLive (all repos backed by SqlClient)
 */

const AlarmStateSqlLayer: Layer.Layer<AlarmState, never, AlarmRepo> =
  Layer.effect(
    AlarmState,
    Effect.gen(function* () {
      const repo = yield* AlarmRepo
      return makeAlarmStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (filter) => repo.query({
          deviceId: filter.deviceId as any,
          severity: filter.severity as any,
          onlyOpen: filter.onlyActive,
          since: filter.since,
          limit: filter.limit,
        }) as any,
        insert: (alarm) => repo.insert(alarm as any) as any,
        update: (alarm) => repo.update(alarm as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const WorkOrderStateSqlLayer: Layer.Layer<WorkOrderState, never, WorkOrderRepo> =
  Layer.effect(
    WorkOrderState,
    Effect.gen(function* () {
      const repo = yield* WorkOrderRepo
      return makeWorkOrderStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (wo) => repo.insert(wo as any) as any,
        update: (wo) => repo.update(wo as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

/**
 * EquipmentState adapter — different shape from standard CRUD adapters.
 *
 * Factory expects: findById, findByMachine(machineId, filter),
 * findActive(machineId), insert, update, endState, delete.
 *
 * Repo has: findById, findByMachine(machineId), findActive(),
 * query({machineId?, state?, onlyActive?}), insert, update, endState, delete.
 */
const EquipmentStateSqlLayer: Layer.Layer<EquipmentStateService, never, EquipmentStateRepo> =
  Layer.effect(
    EquipmentStateService,
    Effect.gen(function* () {
      const repo = yield* EquipmentStateRepo
      return makeEquipmentStateSql({
        findById: (id) => repo.findById(id) as any,
        findByMachine: (machineId, _filter) =>
          repo.findByMachine(machineId) as any,
        findActive: (machineId) =>
          repo.query({ machineId, onlyActive: true }).pipe(
            Effect.map((rows) =>
              rows.length > 0 ? Option.some(rows[0]) : Option.none()
            ),
          ) as any,
        insert: (es) => repo.insert(es as any) as any,
        update: (es) => repo.update(es as any) as any,
        endState: (id, endedAt) =>
          repo.endState(id, endedAt).pipe(Effect.map(() => true)) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const SiteStateSqlLayer: Layer.Layer<SiteState, never, SiteRepo> =
  Layer.effect(
    SiteState,
    Effect.gen(function* () {
      const repo = yield* SiteRepo
      return makeSiteStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (site) => repo.insert(site as any) as any,
        update: (site) => repo.update(site as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const AreaStateSqlLayer: Layer.Layer<AreaState, never, AreaRepo> =
  Layer.effect(
    AreaState,
    Effect.gen(function* () {
      const repo = yield* AreaRepo
      return makeAreaStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (area) => repo.insert(area as any) as any,
        update: (area) => repo.update(area as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const PlantStateSqlLayer: Layer.Layer<PlantState, never, PlantRepo> =
  Layer.effect(
    PlantState,
    Effect.gen(function* () {
      const repo = yield* PlantRepo
      return makePlantStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (plant) => repo.insert(plant as any) as any,
        update: (plant) => repo.update(plant as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const EnterpriseStateSqlLayer: Layer.Layer<EnterpriseState, never, EnterpriseRepo> =
  Layer.effect(
    EnterpriseState,
    Effect.gen(function* () {
      const repo = yield* EnterpriseRepo
      return makeEnterpriseStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (ent) => repo.insert(ent as any) as any,
        update: (ent) => repo.update(ent as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const LineStateSqlLayer: Layer.Layer<LineState, never, LineRepo> =
  Layer.effect(
    LineState,
    Effect.gen(function* () {
      const repo = yield* LineRepo
      return makeLineStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (line) => repo.insert(line as any) as any,
        update: (line) => repo.update(line as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const WorkCellStateSqlLayer: Layer.Layer<WorkCellState, never, WorkCellRepo> =
  Layer.effect(
    WorkCellState,
    Effect.gen(function* () {
      const repo = yield* WorkCellRepo
      return makeWorkCellStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (wc) => repo.insert(wc as any) as any,
        update: (wc) => repo.update(wc as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

const MachineStateSqlLayer: Layer.Layer<MachineState, never, MachineRepo> =
  Layer.effect(
    MachineState,
    Effect.gen(function* () {
      const repo = yield* MachineRepo
      return makeMachineStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (m) => repo.insert(m as any) as any,
        update: (m) => repo.update(m as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

/**
 * Sensor adapter — SensorRepo uses `findByDeviceId(DeviceId)` not `findById(SensorId)`.
 * The Schema `SensorId` and repo `DeviceId` are different branded strings
 * but structurally identical at runtime.
 */
const SensorAssetStateSqlLayer: Layer.Layer<SensorAssetState, never, SensorRepo> =
  Layer.effect(
    SensorAssetState,
    Effect.gen(function* () {
      const repo = yield* SensorRepo
      return makeSensorAssetStateSql({
        findById: (id) => repo.findByDeviceId(id as any) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (s) => repo.insert(s as any) as any,
        update: (s) => repo.update(s as any) as any,
        delete: (id) => repo.delete(id as any).pipe(Effect.map(() => true)),
      })
    })
  )

const DeviceStateSqlLayer: Layer.Layer<DeviceState, never, DeviceRepo> =
  Layer.effect(
    DeviceState,
    Effect.gen(function* () {
      const repo = yield* DeviceRepo
      return makeDeviceStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (d) => repo.insert(d as any) as any,
        update: (d) => repo.update(d as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )

// =============================================================================
// Combined SQL State Layer
// =============================================================================

/**
 * All 12 state services backed by SQL repositories.
 *
 * Requires: IIoTRepositoriesLive (which requires SqlClient.SqlClient)
 *
 * Type Compatibility:
 * Each adapter bridges Model→Schema types at the repo boundary.
 * For full type safety, update Model classes to use domain-specific
 * status enums (e.g., SiteStatus instead of generic AssetStatus).
 */
export const AllStateServicesSql: Layer.Layer<
  | AlarmState | WorkOrderState | EquipmentStateService
  | MachineState | AreaState | SensorAssetState
  | PlantState | EnterpriseState | SiteState
  | WorkCellState | LineState | DeviceState,
  never,
  | AlarmRepo | WorkOrderRepo | EquipmentStateRepo
  | MachineRepo | AreaRepo | SensorRepo
  | PlantRepo | EnterpriseRepo | SiteRepo
  | WorkCellRepo | LineRepo | DeviceRepo
> = Layer.mergeAll(
  AlarmStateSqlLayer,
  WorkOrderStateSqlLayer,
  EquipmentStateSqlLayer,
  MachineStateSqlLayer,
  AreaStateSqlLayer,
  SensorAssetStateSqlLayer,
  PlantStateSqlLayer,
  EnterpriseStateSqlLayer,
  SiteStateSqlLayer,
  WorkCellStateSqlLayer,
  LineStateSqlLayer,
  DeviceStateSqlLayer,
)

// =============================================================================
// Cluster Layer (Production)
// =============================================================================

/**
 * IIoT Cluster deployment stack.
 *
 * Provides:
 * - 12 entity handlers
 * - Feature flags enabled (EventLog integration)
 * - 12 SQL-backed state services (via AllStateServicesSql)
 *
 * Requires: SqlClient.SqlClient (for repositories)
 *
 * Usage:
 * ```ts
 * const ProdApp = program.pipe(
 *   Effect.provide(IIoTClusterLayer),
 *   Effect.provide(PgClient.layer({ /* connection config *\/ })),
 * )
 * ```
 */
export const IIoTClusterLayer = pipe(
  EntityProductionHandlersWithEvents,
  Layer.provide(AllStateServicesSql),
  Layer.provide(IIoTRepositoriesLive),
)

// =============================================================================
// Runtime Layer (Config-Driven)
// =============================================================================

/**
 * Config-driven IIoT layer selector.
 *
 * Reads DeploymentModeConfig and selects the appropriate stack:
 * - 'test' → IIoTTestLayer (in-memory, self-contained)
 * - 'tauri' → IIoTTestLayer (TODO: SQLite implementation)
 * - 'cluster' → IIoTClusterLayer (requires SqlClient)
 *
 * Usage:
 * ```ts
 * // App bootstrap
 * const AppLayer = pipe(
 *   IIoTRuntimeLayer,
 *   Layer.provide(DeploymentModeClusterLayer),
 *   Layer.provide(PgClient.layer({ /* config *\/ })),
 * )
 * ```
 */
export const IIoTRuntimeLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { mode } = yield* DeploymentModeConfig
    switch (mode) {
      case 'test':
        return IIoTTestLayer
      case 'tauri':
        // TODO: SQLite-backed state services for Tauri desktop
        return IIoTTestLayer
      case 'cluster':
        return IIoTClusterLayer
    }
  })
)

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { AllStateServicesInMemory } from '../state'
export { EntityHandlersLayer, EntityTestingStack, EntityProductionHandlersWithEvents } from '../entity/EntityStack'
export {
  DeploymentModeConfig,
  DeploymentModeTestLayer,
  DeploymentModeTauriLayer,
  DeploymentModeClusterLayer,
  DeploymentModeEnvLayer,
  type DeploymentMode,
} from '../infrastructure/deployment-mode'
