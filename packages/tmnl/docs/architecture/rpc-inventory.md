# RPC Inventory

> Consolidated from `thoughts/shared/plans/phase4-rpc-inventory.md`
> Original date: 2026-02-06 | Status: Verified (tsc passes)

## Summary

- **Total RPCs**: ~136 operations (+ discard variants)
- **Composed in**: `IIoTRpcs` RpcGroup (`rpc/index.ts`)
- **Pattern**: Entity-derived via `EntityProxy.toRpcGroup()` + stateless via `Rpc.make()`

## RPC Groups

### Stateless Query RPCs

| Group | File | Operations | Type |
|-------|------|-----------|------|
| AssetRpcs | `rpc/AssetRpcs.ts` | 8 | Hierarchy queries |
| SensorRpcs | `rpc/SensorRpcs.ts` | 4 | Time-series queries |
| StatelessAlarmRpcs | `rpc/AlarmRpcs.ts` | 3 | Alarm queries |

### Entity-Derived RPCs (via EntityProxy.toRpcGroup)

| Group | Entity | Operations | Domain |
|-------|--------|-----------|--------|
| AlarmEntityRpcs | AlarmEntity | 4 (+4 discard) | Alarm lifecycle |
| WorkOrderRpcs | WorkOrderEntity | 12 | WorkOrder lifecycle |
| EquipmentStateRpcs | EquipmentStateEntity | 6 | Equipment state/OEE |
| PlantRpcs | PlantEntity | 10 | ISA-95 Level 4 |
| LineRpcs | LineEntity | 13 | ISA-95 Level 3 |
| WorkCellRpcs | WorkCellEntity | 12 | ISA-95 Level 2 |
| MachineAssetRpcs | MachineAssetEntity | 12 | ISA-95 Level 2 |
| DeviceRpcs | DeviceAssetEntity | 10 | ISA-95 Level 0 |
| SensorAssetRpcs | SensorAssetEntity | 11 | ISA-95 Level 0 |
| EnterpriseRpcs | EnterpriseEntity | 6 | ISA-95 Level 5 |
| SiteRpcs | SiteEntity | 8 | ISA-95 Level 4 |
| AreaRpcs | AreaEntity | 9 | ISA-95 Level 3 |
| AssetEntityRpcs | AssetEntity | 4 | Generic hierarchy |
| SensorEntityRpcs | SensorEntity | 4 | Sensor readings |

### Realtime RPCs (Streaming)

| Group | Operations | Type |
|-------|-----------|------|
| RealtimeRpcs | 5 | WebSocket streaming subscriptions |

## Detailed Operations

### Alarm Domain (7 + 4 discard)

| Operation | Tag | Stream |
|-----------|-----|--------|
| Create | `Alarm.Create` | No |
| Get | `Alarm.Get` | No |
| Acknowledge | `Alarm.Acknowledge` | No |
| Clear | `Alarm.Clear` | No |
| Query | `Alarm.Query` | Yes |
| GetContext | `Alarm.GetContext` | No |
| GetStats | `Alarm.GetStats` | No |

### WorkOrder Lifecycle (12)

Create, Get, Submit, Approve, Reject, Start, Suspend, Resume, Complete, Fail, Cancel, Close

### Equipment State (6)

GetCurrentState, GetStateHistory, TransitionState, UpdateStateReason, GetOee, GetDurations

### ISA-95 Asset Entities (93 total)

| Entity | Ops | Key Lifecycle RPCs |
|--------|-----|-------------------|
| Enterprise | 6 | Create, Get, Restructure, CompleteRestructuring, Merge, Dissolve |
| Site | 8 | Create, Get, BeginConstruction, Commission, SeasonalShutdown, Reopen, Close, Decommission |
| Area | 9 | Create, Get, Restrict, ClearRestriction, EnterMaintenance, ExitMaintenance, Deactivate, Activate, Decommission |
| Plant | 10 | Create, Get, CompleteCommissioning, ScheduledShutdown, Restart, EmergencyShutdown, MaintenanceShutdown, CompleteMaintenanceRestart, Decommission |
| Line | 13 | Create, Get, Start, Stop, BeginChangeover, CompleteChangeover, MarkStarved, ClearStarved, MarkBlocked, ClearBlocked, EnterMaintenance, CompleteMaintenance, Decommission |
| WorkCell | 12 | Create, Get, BeginSetup, CompleteSetup, Stop, MarkBlocked, ClearBlocked, MarkFaulted, ClearFault, EnterMaintenance, CompleteMaintenance, Decommission |
| MachineAsset | 12 | Create, Get, Activate, GoIdle, Resume, MarkFaulted, ScheduleRepair, EmergencyRepair, ScheduleMaintenance, CompleteMaintenance, Retire, Decommission |
| Device | 10 | Create, Get, GoOnline, GoOffline, MarkFaulted, ClearFault, StartFirmwareUpdate, CompleteFirmwareUpdate, FailFirmwareUpdate, Decommission |
| SensorAsset | 11 | Create, Get, StartCalibration, CompleteCalibration, FailCalibration, FlagForCalibration, MarkFaulted, ClearFault, TakeOffline, BringOnline, Decommission |
| Asset (generic) | 4 | Get, GetChildren, GetHierarchy, Update |
| Sensor (readings) | 4 | GetState, GetLatestReading, GetAggregatedReadings, GetReadingStats |

### Realtime Subscriptions (5)

| Operation | Tag | Filter |
|-----------|-----|--------|
| SubscribeReadings | `Realtime.SubscribeReadings` | deviceId, plantId, throttleMs |
| SubscribeAlarms | `Realtime.SubscribeAlarms` | severity, deviceId |
| SubscribeEquipmentState | `Realtime.SubscribeEquipmentState` | machineId |
| SubscribeEntityEvents | `Realtime.SubscribeEntityEvents` | entityType, entityId |
| SubscribeInvalidations | `Realtime.SubscribeInvalidations` | (none) |
