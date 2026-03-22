# Kraken Handoff: Property-Based Schema Tests

## Task
Add property-based tests for IIoT schemas using fast-check with Effect Schema.Arbitrary.

## Checkpoints
<!-- Resumable state for kraken agent -->
**Task:** Property-based tests for IIoT schemas
**Started:** 2026-01-31T12:30:00Z
**Last Updated:** 2026-01-31T12:45:00Z

### Phase Status
- Phase 1 (Tests Written): VALIDATED (137 tests passing)
- Phase 2 (Implementation): VALIDATED (no schema changes needed - test-only task)
- Phase 3 (Refactoring): VALIDATED (tests refactored for discovered edge cases)
- Phase 4 (Documentation): COMPLETED

### Validation State
```json
{
  "test_count": 137,
  "tests_passing": 137,
  "files_modified": ["src/lib/iiot/__tests__/schemas/property-based.test.ts"],
  "last_test_command": "bun test src/lib/iiot/__tests__/schemas/property-based.test.ts --no-watch",
  "last_test_exit_code": 0
}
```

### Resume Context
- Current focus: Task complete
- Next action: None - all phases validated
- Blockers: None

## Implementation Notes

### fast-check Integration
- Effect v3.19.14 bundles fast-check v3.23.2 internally
- Import via `import { FastCheck as fc } from 'effect'` to avoid version conflicts
- Do NOT add fast-check to package.json devDependencies separately

### Discovered Issue
Property-based testing discovered that `Asset.getAutomationLevel()` doesn't handle all EquipmentLevel values:
- Handled: enterprise, site, area, line, machine, sensor
- Not handled: plant, workcell, device

This is documented in the test and returns `undefined` for unhandled cases. Consider filing a bug to complete the switch statement.

## Files Created
- `src/lib/iiot/__tests__/schemas/property-based.test.ts` (137 tests)

## Test Coverage

### Branded Identifiers (14 types)
- PlantId, LineId, MachineId, SensorId, DeviceId, AlarmId
- WorkOrderId, AssetId, EnterpriseId, SiteId, AreaId
- WorkCellId, EventId, FactId

### Pattern-Based Identifiers (2 types)
- EquipmentStateId (EST-{slug} pattern)
- DeviceConfigId (CFG-{slug} pattern)

### Literal/Enum Schemas (15 types)
- EquipmentLevel, AssetStatus, SensorType, MeasurementUnit
- AlarmSeverity, AlarmType, AlarmState
- QualityScore, TimeBucket, OpcUaQuality
- WorkOrderStatus, WorkOrderPriority, WorkOrderType
- StateType, StateReason, ConfigVersion, ConfigStatus

### Complex Entities (10 types)
- Asset, AssetLocation, SensorProperties
- Alarm, AlarmSummary, AlarmContext, AlarmTransition
- SensorReading, AggregatedReading, AnalyticsRecord
- WorkOrder, EquipmentState, DeviceConfig
- StateDurationAggregate

### Property Categories
1. **Roundtrip**: decode(encode(x)) === x
2. **Idempotent Encoding**: encode(decode(encode(x))) === encode(x)
3. **Type Invariants**: typeof checks, _tag validation
4. **Bounds Checking**: QualityScore 0-100, lat/lng bounds
5. **State Machine Consistency**: OEE categories, terminal states
6. **Method Contracts**: isActive(), isProductive(), etc.
