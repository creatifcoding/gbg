# IIoT API Reference

Module-by-module reference for the `@gbg/tmnl/iiot` public API surface.

## Table of Contents

- [Schemas](#schemas) -- ISA-95 asset hierarchy data models
- [Entities](#entities) -- Effect Cluster distributed actors
- [State Services](#state-services) -- Swappable persistence layer
- [RPC Groups](#rpc-groups) -- Remote procedure call definitions
- [HTTP Layer](#http-layer) -- REST API, RPC server, middleware
- [Realtime](#realtime) -- WebSocket streaming, event distribution, NATS bridge
- [Infrastructure](#infrastructure) -- EventLog, feature flags, deployment mode

---

## Schemas

ISA-95 equipment hierarchy data models using Effect Schema.

| Module | ISA-95 Level | Description |
|--------|-------------|-------------|
| `schemas/assets/enterprise` | Level 4 | Top-level business entity |
| `schemas/assets/site` | Level 3 | Physical location / facility |
| `schemas/assets/area` | Level 2 | Production area (building/floor/zone) |
| `schemas/assets/plant` | Level 2 | Functional production unit |
| `schemas/assets/line` | Level 1 | Production line (sequential process) |
| `schemas/assets/workcell` | Level 1 | Discrete production station |
| `schemas/assets/machine` | Level 1 | Production equipment / work unit |
| `schemas/assets/device` | Level 0 | Field device (PLC, controller) |
| `schemas/assets/sensor` | Level 0 | Measurement point (temperature, pressure) |
| `schemas/assets/common` | -- | Shared fields (BaseAssetFields, AssetLocation, AssetMetadata) |

Each schema module exports:
- `*Id` -- Branded identifier schema (e.g., `SiteId`, pattern `SIT-{slug}`)
- `make*Id(slug)` -- Factory function to create branded IDs
- `*Status` -- Domain-specific lifecycle states (e.g., `'planned' | 'operational' | 'decommissioned'`)
- `*` class -- `Schema.TaggedClass` with methods (`getAutomationLevel()`, `isOperational()`, `isContainer()`, `materializePath()`)
- `Create*Params` -- Parameters for entity creation
- `Update*Params` -- Parameters for entity updates (where applicable)

**Source**: `src/lib/iiot/schemas/assets/`

---

## Entities

Effect Cluster entities -- distributed actors managing lifecycle state via Machine-backed handlers.

### Event-Sourced Entities (barrel-exported)

| Export | Domain | Description |
|--------|--------|-------------|
| `AlarmEntity` | ISA-18.2 | Alarm lifecycle (triggered -> acknowledged -> cleared) |
| `WorkOrderEntity` | FDA 21 CFR 11 | Work order lifecycle (draft -> approved -> completed) |
| `EquipmentStateEntity` | OEE | Equipment state tracking (running -> faulted -> idle) |
| `AssetEntity` | Hierarchy | ISA-95 hierarchy CRUD (get, children, hierarchy, update) |
| `SensorEntity` | Readings | Sensor state and time-series aggregation |

### ISA-95 Asset Entities (import directly)

These share generic RPC error names and must be imported from individual files:

| Entity | File | Operations |
|--------|------|------------|
| `EnterpriseEntity` | `entity/EnterpriseEntity.ts` | Create, Get, Restructure, Merge, Dissolve |
| `SiteEntity` | `entity/SiteEntity.ts` | Create, Get, BeginConstruction, Commission, SeasonalShutdown, Reopen, Close, Decommission |
| `AreaEntity` | `entity/AreaEntity.ts` | Create, Get, Restrict, ClearRestriction, EnterMaintenance, ExitMaintenance |
| `PlantEntity` | `entity/PlantEntity.ts` | Create, Get, CompleteCommissioning, ScheduledShutdown, Restart, EmergencyShutdown |
| `LineEntity` | `entity/LineEntity.ts` | Create, Get, Start, Stop, BeginChangeover, CompleteChangeover, MarkStarved |
| `WorkCellEntity` | `entity/WorkCellEntity.ts` | Create, Get, BeginSetup, CompleteSetup, Stop, MarkBlocked, ClearBlocked |
| `MachineAssetEntity` | `entity/MachineAssetEntity.ts` | Create, Get, Activate, GoIdle, Resume, MarkFaulted, ScheduleRepair |
| `DeviceEntity` | `entity/DeviceEntity.ts` | Create, Get, GoOnline, GoOffline, MarkFaulted, ClearFault |
| `SensorAssetEntity` | `entity/SensorAssetEntity.ts` | Create, Get, StartCalibration, CompleteCalibration, FailCalibration |

### Layer Composition

| Export | Description |
|--------|-------------|
| `EntityHandlersLayer` | All 12 entity handlers merged (requires state + feature flags) |
| `EntityTestingStack` | Complete test stack (in-memory state, flags disabled) |
| `EntityProductionHandlersWithEvents` | Handlers with flags enabled (requires SQL state) |

**Source**: `src/lib/iiot/entity/`

---

## State Services

Swappable persistence layer with in-memory (testing) and SQL (production) implementations.

| Service Tag | Domain | Filter Type |
|-------------|--------|-------------|
| `AlarmState` | Alarms | `AlarmFilter` |
| `WorkOrderState` | Work Orders | `WorkOrderFilter` |
| `EquipmentStateService` | Equipment | `EquipmentStateFilter` |
| `SiteState` | Sites | `SiteFilter` |
| `AreaState` | Areas | `AreaFilter` |
| `PlantState` | Plants | `PlantFilter` |
| `LineState` | Lines | `LineFilter` |
| `WorkCellState` | WorkCells | `WorkCellFilter` |
| `MachineState` | Machines | `MachineFilter` |
| `DeviceState` | Devices | `DeviceFilter` |
| `SensorAssetState` | Sensors | `SensorAssetFilter` |
| `EnterpriseState` | Enterprises | `EnterpriseFilter` |

Each state service provides: `create`, `get`, `set`, `list`, `delete`, `exists`, `count`

| Layer | Description |
|-------|-------------|
| `*InMemory` | In-memory implementation for testing |
| `make*Sql(repo)` | SQL factory accepting a repository object |
| `AllStateServicesInMemory` | All 12 services merged for testing |

**Source**: `src/lib/iiot/state/`

---

## RPC Groups

Remote procedure call definitions for the IIoT system.

### Stateless Query RPCs

| Group | Operations |
|-------|------------|
| `SensorRpcs` | GetLatest, Query, QueryAggregated, Subscribe |
| `AssetRpcs` | GetSensorHierarchy, GetPlantHierarchy, GetMachineWithSensors |
| `AlarmRpcs` | Query, Context, Stats |

### Entity-Derived RPCs

Generated via `EntityProxy.toRpcGroup()` -- creates standard + discard (fire-and-forget) variants:

| Group | Entity | Operations |
|-------|--------|------------|
| `PlantRpcs` | PlantEntity | Create, Get, + state transitions |
| `LineRpcs` | LineEntity | Create, Get, Start, Stop, + transitions |
| `WorkCellRpcs` | WorkCellEntity | Create, Get, + setup/block transitions |
| `MachineAssetRpcs` | MachineAssetEntity | Create, Get, + lifecycle transitions |
| `DeviceRpcs` | DeviceEntity | Create, Get, + online/offline transitions |
| `SensorAssetRpcs` | SensorAssetEntity | Create, Get, + calibration transitions |
| `EnterpriseRpcs` | EnterpriseEntity | Create, Get, + restructure/merge |
| `SiteRpcs` | SiteEntity | Create, Get, + construction/commission |
| `AreaRpcs` | AreaEntity | Create, Get, + restrict/maintenance |
| `WorkOrderRpcs` | WorkOrderEntity | Create through Close (12 operations) |
| `EquipmentStateRpcs` | EquipmentStateEntity | GetCurrent, Transition, GetOee, GetDurations |
| `AssetEntityRpcs` | AssetEntity | Get, GetChildren, GetHierarchy, Update |
| `SensorEntityRpcs` | SensorEntity | GetState, GetLatest, GetAggregated, GetStats |

### Realtime Streaming RPCs

| RPC | Stream Type | Description |
|-----|------------|-------------|
| `SubscribeReadings` | `SensorReading` | Live sensor readings with deviceId/plantId filter + throttle |
| `SubscribeAlarms` | `AlarmEvent` | Alarm lifecycle events with severity filter |
| `SubscribeEquipmentState` | `EquipmentStateChange` | State transitions with entityType filter |
| `SubscribeInvalidations` | `CacheInvalidation` | Cache key invalidation with glob pattern matching |

### Combined Group

| Export | Description |
|--------|-------------|
| `IIoTRpcs` | Single RpcGroup containing all IIoT operations |

**Source**: `src/lib/iiot/rpc/`

---

## HTTP Layer

REST API, raw RPC server, and middleware.

### Server Composition

| Export | Description |
|--------|-------------|
| `IIoTApi` | Combined HttpApi with all 13 entity domains + query groups |
| `IIoTHttpServerDev` | Dev server (in-memory cluster, Swagger at /docs) |

### RPC Server

| Export | Wire Format | Path |
|--------|------------|------|
| `IIoTRpcServer` | ndjson (default) | `/rpc` |
| `IIoTRpcNdjson` | ndjson | `/rpc` |
| `IIoTRpcMsgPack` | msgpack (binary) | `/rpc` |

### Cluster

| Export | Description |
|--------|-------------|
| `ClusterDev` | In-memory cluster (TestRunner, no external deps) |
| `ClusterProd` | Distributed cluster (requires SqlClient) |

### Handlers

| Export | Description |
|--------|-------------|
| `ProxyHandlers` | EntityProxy REST handlers for all entity domains |
| `QueryHandlers` | Stateless query handlers |
| `AssetQueryGroup` | Asset hierarchy query endpoints |
| `SensorQueryGroup` | Sensor reading query endpoints |
| `AlarmQueryGroup` | Alarm query endpoints |
| `WorkOrderQueryGroup` | Work order query endpoints |

### Middleware

| Export | Description |
|--------|-------------|
| `IIoTAuthMiddleware` | Bearer token authentication |
| `IIoTAuthBearerLayer` | Auth enabled (validates tokens) |
| `IIoTAuthDisabledLayer` | Auth disabled (passthrough for dev) |
| `IIoTRateLimitMiddleware` | Per-client request throttling |
| `IIoTRateLimitEnabledLayer` | Rate limiting enabled (429 with Retry-After) |
| `IIoTRateLimitDisabledLayer` | Rate limiting disabled (passthrough for dev) |

**Source**: `src/lib/iiot/http/`

---

## Realtime

WebSocket streaming, event distribution, and NATS bridge.

### EventDistribution

Central event hub routing events through ChannelService broadcast outlets.

| Export | Description |
|--------|-------------|
| `EventDistribution` | Service tag (central event hub) |
| `EventDistributionLayer` | Composable layer (requires ChannelService + HolonetBridge) |
| `EventDistributionLive` | Partially self-contained (bundles ChannelService, requires HolonetBridge) |

4 internal channels:
- `iiot:readings` (maxLag 10,000) -- high-throughput sensor data
- `iiot:alarms` (maxLag 1,000) -- alarm lifecycle events
- `iiot:equipment` (maxLag 1,000) -- equipment state transitions
- `iiot:invalidations` (maxLag 1,000) -- cache invalidation signals

### WebSocket Server

| Export | Description |
|--------|-------------|
| `IIoTRealtimeWsServer` | WS server at `/ws/iiot` (requires EventDistribution) |
| `IIoTRealtimeWsServerLive` | Self-contained WS server (bundles EventDistribution) |
| `RealtimeRpcGroupHandlersLayer` | Handler layer bridging RealtimeRpcs to EventDistribution |

### Handlers

| Export | Description |
|--------|-------------|
| `RealtimeRpcHandlers` | Service tag for streaming RPC handlers |
| `RealtimeRpcHandlersLayer` | Composable layer (requires EventDistribution) |
| `RealtimeRpcHandlersLive` | Partially self-contained (requires HolonetBridge) |

### NATS Integration

| Export | Description |
|--------|-------------|
| `HolonetBridge` | Service tag (NATS publish/subscribe) |
| `HolonetBridgeLayer` | Composable layer (requires NatsPubSubService) |
| `HolonetBridgeStub` | Test stub (no-op publishes, empty streams) |

### Subject Definitions

| Export | NATS Pattern | Description |
|--------|-------------|-------------|
| `IIoTReadingsSubject` | `iiot.readings.{deviceId}` | Sensor reading events |
| `IIoTAlarmsSubject` | `iiot.alarms.{deviceId}` | Alarm lifecycle events |
| `IIoTEquipmentSubject` | `iiot.equipment.{equipmentId}` | Equipment state transitions |
| `IIoTInvalidationsSubject` | `iiot.invalidations.{cacheKey}` | Cache invalidation signals |

### ReactivityBridge

| Export | Description |
|--------|-------------|
| `ReactivityBridge` | Handler-to-EventDistribution adapter (Approach A) |
| `ReactivityBridgeLayer` | Composable layer (requires EventDistribution) |

### Deployment Layers

| Export | Description |
|--------|-------------|
| `IIoTRealtimeDistributed` | Full WS + Holonet stack (requires NatsPubSubService) |
| `IIoTAdapterDistributed(config)` | Sparkplug adapter + KV state (requires NatsKVService) |

**Source**: `src/lib/iiot/realtime/`

---

## Infrastructure

Event sourcing, feature flags, and deployment mode configuration.

### EventLog

| Export | Description |
|--------|-------------|
| `IIoTEventLogSchema` | Schema for IIoT event log entries |
| `IIoTEventJournalMemoryLayer` | In-memory journal (testing) |
| `IIoTEventJournalSqlLayer` | SQL-backed journal (production) |
| `IIoTEventLogStackLayer` | Complete EventLog stack (memory) |
| `makeIIoTEventLogStackSqlLayer` | Complete EventLog stack factory (SQL) |
| `EventLog`, `EventJournal` | Re-exported Effect services |

### Feature Flags

| Export | Description |
|--------|-------------|
| `IIoTFeatureFlags` | Service tag for EventLog migration flags |
| `IIoTFeatureFlagsDefault` | All flags disabled (safe for production) |
| `IIoTFeatureFlagsDisabledLayer` | Layer with all flags disabled |
| `IIoTFeatureFlagsEnabledLayer` | Layer with all flags enabled (testing) |
| `IIoTFeatureFlagsEnvLayer` | Layer reading from `ES_*` environment variables |
| `makeFeatureFlagsLayer(overrides)` | Custom flag layer factory |
| `isAlarmEventSourcingEnabled` | Effect checking alarm flag |
| `isEquipmentStateEventSourcingEnabled` | Effect checking equipment flag |
| `isWorkOrderEventSourcingEnabled` | Effect checking work order flag |
| `isBatchRecordEventSourcingEnabled` | Effect checking batch record flag |

### Deployment Mode

| Export | Description |
|--------|-------------|
| `DeploymentMode` | Schema: `'test' \| 'tauri' \| 'cluster'` |
| `DeploymentModeConfig` | Service tag for runtime mode |
| `DeploymentModeTestLayer` | Test mode (in-memory) |
| `DeploymentModeTauriLayer` | Tauri mode (SQLite) |
| `DeploymentModeClusterLayer` | Cluster mode (PostgreSQL + NATS) |
| `DeploymentModeEnvLayer` | Reads `IIOT_DEPLOYMENT_MODE` env var |

**Source**: `src/lib/iiot/infrastructure/`
