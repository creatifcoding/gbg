# IIOT Entity Porting Inventory (Execution Seed)

Source baseline: `src/lib/iiot/entity`

## Observed entity modules

1. AlarmEntity
2. AreaEntity
3. AssetEntity
4. DeviceEntity
5. EnterpriseEntity
6. EquipmentStateEntity
7. LineEntity
8. MachineAssetEntity
9. PlantEntity
10. SensorAssetEntity
11. SensorEntity
12. SiteEntity
13. WorkCellEntity
14. WorkOrderEntity

## Handler-layer membership (from `EntityStack.ts`)

Included in `EntityHandlersLayer` (12):
- AlarmEntity
- WorkOrderEntity
- EquipmentStateEntity
- EnterpriseEntity
- SiteEntity
- AreaEntity
- PlantEntity
- LineEntity
- WorkCellEntity
- MachineAssetEntity
- DeviceEntity
- SensorAssetEntity

Not included in `EntityHandlersLayer`:
- AssetEntity
- SensorEntity

## Decision note

You referenced "13 entities". Current source inventory shows 14 modules.
Before macro-port execution, we should lock the exact target set (which module is excluded or merged).

## Immediate high-value execution pattern

- Preserve TS Effect Schema as canonical contract source.
- Add Elixir-side constructor + validator + runtime harness per entity lane.
- Port sequence recommendation:
  1. WorkOrder
  2. Alarm
  3. EquipmentState
  4. Enterprise/Site/Area
  5. Plant/Line/WorkCell
  6. MachineAsset/Device/SensorAsset
  7. Asset/Sensor query entities
