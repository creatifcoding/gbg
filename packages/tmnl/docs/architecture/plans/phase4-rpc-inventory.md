# Phase 4: RPC Inventory

**Date**: 2026-02-06
**Status**: VERIFIED (tsc passes)
**Source**: Scout report + Grep audit

---

## Summary

**Total RPCs**: ~136 operations (+ discard variants)
**Composed in IIoTRpcs**: All (as of 2026-02-06, rpc-composer completed)
**Pattern**: Entity-derived via `EntityProxy.toRpcGroup()` + stateless via `Rpc.make()`

---

## RPC Groups in `IIoTRpcs`

### Stateless Query RPCs (existing before Phase 4)

| Group | File | Operations | Type |
|-------|------|-----------|------|
| **AssetRpcs** | `rpc/AssetRpcs.ts` | 8 | Stateless (hierarchy queries) |
| **SensorRpcs** | `rpc/SensorRpcs.ts` | 4 | Stateless (time-series queries) |
| **StatelessAlarmRpcs** | `rpc/AlarmRpcs.ts` | 3 | Stateless (alarm queries) |

### Entity-Derived RPCs (via EntityProxy.toRpcGroup)

| Group | File | Entity | Operations | Domain |
|-------|------|--------|-----------|--------|
| **AlarmEntityRpcs** | `rpc/AlarmRpcs.ts` | AlarmEntity | 4 (+4 discard) | Alarm lifecycle |
| **WorkOrderRpcs** | `rpc/WorkOrderRpcs.ts` | WorkOrderEntity | 12 | WorkOrder lifecycle |
| **EquipmentStateRpcs** | `rpc/EquipmentStateRpcs.ts` | EquipmentStateEntity | 6 | Equipment state/OEE |
| **PlantRpcs** | `rpc/PlantRpcs.ts` | PlantEntity | 10 | ISA-95 Level 4 |
| **LineRpcs** | `rpc/LineRpcs.ts` | LineEntity | 13 | ISA-95 Level 3 |
| **WorkCellRpcs** | `rpc/WorkCellRpcs.ts` | WorkCellEntity | 12 | ISA-95 Level 2 |
| **MachineAssetRpcs** | `rpc/MachineAssetRpcs.ts` | MachineAssetEntity | 12 | ISA-95 Level 2 |
| **DeviceRpcs** | `rpc/DeviceRpcs.ts` | DeviceAssetEntity | 10 | ISA-95 Level 0 |
| **SensorAssetRpcs** | `rpc/SensorAssetRpcs.ts` | SensorAssetEntity | 11 | ISA-95 Level 0 |
| **EnterpriseRpcs** | `rpc/EnterpriseRpcs.ts` | EnterpriseEntity | 6 | ISA-95 Level 5 |
| **SiteRpcs** | `rpc/SiteRpcs.ts` | SiteEntity | 8 | ISA-95 Level 4 |
| **AreaRpcs** | `rpc/AreaRpcs.ts` | AreaEntity | 9 | ISA-95 Level 3 |
| **AssetEntityRpcs** | `rpc/AssetEntityRpcs.ts` | AssetEntity | 4 | Generic hierarchy |
| **SensorEntityRpcs** | `rpc/SensorEntityRpcs.ts` | SensorEntity | 4 | Sensor readings |

---

## Detailed Operation Inventory

### Alarm Domain (7 operations + 4 discard)

| Operation | Tag | Type | Stream | Entity-Derived |
|-----------|-----|------|--------|----------------|
| Create | `Alarm.Create` | Entity | No | Yes |
| Get | `Alarm.Get` | Entity | No | Yes |
| Acknowledge | `Alarm.Acknowledge` | Entity | No | Yes |
| Clear | `Alarm.Clear` | Entity | No | Yes |
| Query | `Alarm.Query` | Stateless | Yes | No |
| GetContext | `Alarm.GetContext` | Stateless | No | No |
| GetStats | `Alarm.GetStats` | Stateless | No | No |

### Asset Hierarchy Queries (8 operations)

| Operation | Tag | Stream |
|-----------|-----|--------|
| ListPlants | `Plant.List` | Yes |
| GetPlant | `Plant.Get` | No |
| GetPlantHierarchy | `Plant.GetHierarchy` | No |
| ListLinesForPlant | `Line.ListForPlant` | Yes |
| ListMachinesForLine | `Machine.ListForLine` | Yes |
| GetMachineWithSensors | `Machine.GetWithSensors` | No |
| ListSensorsForMachine | `Sensor.ListForMachine` | Yes |
| GetSensorHierarchy | `Sensor.GetHierarchy` | No |

### Sensor Time-Series (4 operations)

| Operation | Tag | Stream |
|-----------|-----|--------|
| GetLatest | `SensorReading.GetLatest` | No |
| Query | `SensorReading.Query` | Yes |
| QueryAggregated | `SensorReading.QueryAggregated` | Yes |
| Subscribe | `SensorReading.Subscribe` | Yes |

### WorkOrder Lifecycle (12 operations)

| Operation | Tag |
|-----------|-----|
| Create | `WorkOrder.Create` |
| Get | `WorkOrder.Get` |
| Submit | `WorkOrder.Submit` |
| Approve | `WorkOrder.Approve` |
| Reject | `WorkOrder.Reject` |
| Start | `WorkOrder.Start` |
| Suspend | `WorkOrder.Suspend` |
| Resume | `WorkOrder.Resume` |
| Complete | `WorkOrder.Complete` |
| Fail | `WorkOrder.Fail` |
| Cancel | `WorkOrder.Cancel` |
| Close | `WorkOrder.Close` |

### Equipment State (6 operations)

| Operation | Tag |
|-----------|-----|
| GetCurrentState | `EquipmentState.GetCurrent` |
| GetStateHistory | `EquipmentState.GetHistory` |
| TransitionState | `EquipmentState.Transition` |
| UpdateStateReason | `EquipmentState.UpdateReason` |
| GetOee | `EquipmentState.GetOee` |
| GetDurations | `EquipmentState.GetDurations` |

### ISA-95 Asset Entities (93 operations total)

| Entity | Operations | Key RPCs |
|--------|-----------|----------|
| Enterprise | 6 | Create, Get, Restructure, CompleteRestructuring, Merge, Dissolve |
| Site | 8 | Create, Get, BeginConstruction, Commission, SeasonalShutdown, Reopen, Close, Decommission |
| Area | 9 | Create, Get, Restrict, ClearRestriction, EnterMaintenance, ExitMaintenance, Deactivate, Activate, Decommission |
| Plant | 10 | Create, Get, CompleteCommissioning, ScheduledShutdown, Restart, EmergencyShutdown, BeginEmergencyMaintenance, MaintenanceShutdown, CompleteMaintenanceRestart, Decommission |
| Line | 13 | Create, Get, Start, Stop, BeginChangeover, CompleteChangeover, MarkStarved, ClearStarved, MarkBlocked, ClearBlocked, EnterMaintenance, CompleteMaintenance, Decommission |
| WorkCell | 12 | Create, Get, BeginSetup, CompleteSetup, Stop, MarkBlocked, ClearBlocked, MarkFaulted, ClearFault, EnterMaintenance, CompleteMaintenance, Decommission |
| MachineAsset | 12 | Create, Get, Activate, GoIdle, Resume, MarkFaulted, ScheduleRepair, EmergencyRepair, ScheduleMaintenance, CompleteMaintenance, Retire, Decommission |
| Device | 10 | Create, Get, GoOnline, GoOffline, MarkFaulted, ClearFault, StartFirmwareUpdate, CompleteFirmwareUpdate, FailFirmwareUpdate, Decommission |
| SensorAsset | 11 | Create, Get, StartCalibration, CompleteCalibration, FailCalibration, FlagForCalibration, MarkFaulted, ClearFault, TakeOffline, BringOnline, Decommission |
| Asset (generic) | 4 | Get, GetChildren, GetHierarchy, Update |
| Sensor (readings) | 4 | GetState, GetLatestReading, GetAggregatedReadings, GetReadingStats |

---

## Composition in `rpc/index.ts` (VERIFIED — matches actual code)

```typescript
export const IIoTRpcs = RpcGroup.make(
  // Stateless query RPCs
  ...Array.from(SensorRpcs.requests.values()),
  ...Array.from(AssetRpcs.requests.values()),
  // Entity-derived RPCs (all 14 groups)
  ...Array.from(AlarmRpcs.requests.values()),
  ...Array.from(WorkOrderRpcs.requests.values()),
  ...Array.from(EquipmentStateRpcs.requests.values()),
  ...Array.from(PlantRpcs.requests.values()),
  ...Array.from(LineRpcs.requests.values()),
  ...Array.from(WorkCellRpcs.requests.values()),
  ...Array.from(MachineAssetRpcs.requests.values()),
  ...Array.from(DeviceRpcs.requests.values()),
  ...Array.from(SensorAssetRpcs.requests.values()),
  ...Array.from(EnterpriseRpcs.requests.values()),
  ...Array.from(SiteRpcs.requests.values()),
  ...Array.from(AreaRpcs.requests.values()),
  ...Array.from(AssetEntityRpcs.requests.values()),
  ...Array.from(SensorEntityRpcs.requests.values()),
)
```

> **NOTE**: Group names above match the actual rpc/index.ts imports. The previous
> version used speculative names like `AlarmEntityRpcs`, `AssetHierarchyEntityRpcs`
> which don't match. Corrected to `AlarmRpcs`, `AssetEntityRpcs` etc.

---

## Notes

- All RPCs are pure (R = never) — dependencies injected at handler layer
- EntityProxy.toRpcGroup() generates standard + discard variants
- Discard variants are fire-and-forget (no response awaited)
- Streaming RPCs use `stream: true` — natural for sensor subscriptions

## HTTP Exposure Status (Updated 2026-02-06)

| RPC Type | HTTP Endpoint | Status |
|----------|---------------|--------|
| Entity-derived (13 entities) | `POST /api/{domain}/{rpc-tag}/:entityId` | IMPLEMENTED (via EntityProxy.toHttpApiGroup + EntityProxyServer.layerHttpApi) |
| Stateless queries (15 RPCs) | `GET /api/queries/{path}` | IMPLEMENTED (via manual HttpApiGroup in query-api.ts, stub handlers) |
| Raw RPC binary | `POST /rpc` | NOT YET (Task #12, blocked on primaryKey) |

**Stateless query HttpApiGroups** (query-api.ts):
- AssetQueryGroup: 8 GET endpoints (`/queries/plants/*`, `/queries/lines/*`, `/queries/machines/*`, `/queries/sensors/*`)
- SensorQueryGroup: 4 GET endpoints (`/queries/readings/*`)
- AlarmQueryGroup: 3 GET endpoints (`/queries/alarms/*`)

These are NOT in IIoTRpcs (they remain as standalone HttpApiGroups). The IIoTRpcs group is for the raw `/rpc` endpoint (Task #12).
