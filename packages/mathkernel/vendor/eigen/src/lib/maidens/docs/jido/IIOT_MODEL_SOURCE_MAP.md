# IIOT Model Source Map (Model-First Porting)

Canonical TS model source: `src/lib/iiot/schemas/**` (Effect Schema / TaggedClass)

## First-wave micro ports (locked)

- WorkOrder → `src/lib/iiot/schemas/work-orders.ts` (`WorkOrder`, `WorkOrderTransition`)
- Alarm → `src/lib/iiot/schemas/alarms.ts` (`Alarm`, transition/lifecycle companions)
- EquipmentState → `src/lib/iiot/schemas/equipment-state/schema.ts` (`EquipmentState`)
- ISA-95 hierarchy core:
  - Enterprise → `src/lib/iiot/schemas/assets/enterprise/schema.ts`
  - Site → `src/lib/iiot/schemas/assets/site/schema.ts`
  - Area → `src/lib/iiot/schemas/assets/area/schema.ts`

## Macro lane targets (remaining)

- Plant → `src/lib/iiot/schemas/assets/plant/schema.ts`
- Line → `src/lib/iiot/schemas/assets/line/schema.ts`
- WorkCell → `src/lib/iiot/schemas/assets/workcell/schema.ts`
- Machine → `src/lib/iiot/schemas/assets/machine/schema.ts`
- Device → `src/lib/iiot/schemas/assets/device/schema.ts`
- SensorAsset / Sensor → `src/lib/iiot/schemas/assets/sensor/schema.ts`
- Asset polymorphic wrappers → `src/lib/iiot/schemas/asset-polymorphic.ts`

## Porting rule

Use model exports above as canonical structure for:
1. JSON Schema generation artifacts in `src/lib/maidens/domains/contracts/<entity>/schemas`
2. Elixir validator payload contracts
3. Jido runtime agent state + transition preflight contracts
