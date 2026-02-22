---
name: adal-schema-drift
description: Analyze schema drift between Effect.Schema, @effect/sql Model, and PostgreSQL DDL. Generates ASCII ER diagrams and diff tables. Invoke when asked about schema alignment, DDL drift, model discrepancies, or database-TypeScript type mismatches.
triggers:
  - "schema drift"
  - "DDL mismatch"
  - "model alignment"
  - "type discrepancy"
  - "database schema"
  - "Effect Schema"
  - "adal"
---

# ADAL Schema Drift Detector

ASCII Diagram Alignment Layer - Detects and visualizes drift between the IIoT schema triad:

1. **Effect.Schema** - Domain types (validation, transformation)
2. **@effect/sql Model** - Persistence layer (DB ↔ TypeScript mapping)
3. **PostgreSQL DDL** - Database schema (CREATE TABLE)

## Invocation

This skill shells to the ADAL pi extension:

```bash
# Analyze a known domain
pi --extension .pi/extensions/adal/index.ts -p "Use schema_drift tool with domain=\"work-orders\""

# Available domains
# - work-orders
# - alarms
# - equipment-state
# - device-config
# - readings
```

## Quick Command

Use the `/adal` command in pi:

```
/adal work-orders
/adal alarms
```

## Output Formats

### ER Diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    WorkOrder — Schema Triad Alignment                         │
├────────────┬──────────────┬──────────────┬─────────────────┬────────┤
│ Field      │ Schema       │ Model        │ DDL             │ Status │
├────────────┼──────────────┼──────────────┼─────────────────┼────────┤
│ id         │ string       │ string       │ TEXT PK         │ ✓ OK   │
│ status     │ Lit(11)      │ Lit(11)      │ TEXT CHK(10) NN │ ✗ ERR  │
│ createdAt  │ datetime     │ datetime     │ TIMESTAMPTZ NN  │ ✓ OK   │
└────────────┴──────────────┴──────────────┴─────────────────┴────────┘
```

### Diff Table

```
DRIFT ANALYSIS
════════════════════════════════════════════════════════════

✗ ERRORS
────────────────────────────────────
  status:
    • Schema has values not in DDL CHECK: resumed
```

### Summary

```
SUMMARY
══════════════════════════════
Entity:    WorkOrder
Fields:    25

✓ OK:      22 (88%)
⚠ WARN:    2
✗ ERROR:   1
```

## Discrepancy Types Detected

| Type | Description | Severity |
|------|-------------|----------|
| **Missing Field** | Present in one layer but not another | WARN/ERR |
| **Type Mismatch** | Incompatible types (e.g., string vs INTEGER) | ERROR |
| **Nullability** | Optional in Schema but NOT NULL in DDL | WARN |
| **Literal Drift** | Schema.Literal values ≠ CHECK constraint | ERROR |
| **Default Drift** | Schema has default, DDL doesn't | WARN |

## How It Works

1. **Schema Inspection**: Dynamically imports the Schema module, accesses `.ast` via `SchemaAST.getPropertySignatures()`
2. **Model Inspection**: Dynamically imports the Model class, accesses `.fields`
3. **DDL Parsing**: Uses `pgsql-ast-parser` to parse CREATE TABLE statements from template literals
4. **Comparison**: Normalizes names (camelCase ↔ snake_case) and types, detects drift
5. **Rendering**: Generates ASCII box diagrams and diff tables

## File Locations

| Component | Path |
|-----------|------|
| Extension | `.pi/extensions/adal/index.ts` |
| Inspectors | `.pi/extensions/adal/inspectors.ts` |
| DDL Parser | `.pi/extensions/adal/ddl-parser.ts` |
| Analyzer | `.pi/extensions/adal/analyzer.ts` |
| Renderer | `.pi/extensions/adal/renderer.ts` |

## IIoT Domain Mappings

| Domain | Schema | Model | DDL |
|--------|--------|-------|-----|
| work-orders | `schemas/work-orders.ts` | `models/work-orders/WorkOrderModel.ts` | `WorkOrderModel.ddl.ts` |
| alarms | `schemas/alarms.ts` | `models/alarms/AlarmModel.ts` | `AlarmModel.ddl.ts` |
| equipment-state | `schemas/equipment-state/` | `models/equipment-state/` | `EquipmentStateModel.ddl.ts` |
| device-config | `schemas/device-config/` | `models/device-config/` | `DeviceConfigModel.ddl.ts` |
| readings | `schemas/readings.ts` | `models/readings/` | `SensorReadingModel.ddl.ts` |

## Custom Paths

For entities not in the predefined list:

```bash
pi -p "Use schema_drift tool with schemaPath=\"src/my/schema.ts\" schemaExport=\"MySchema\" modelPath=\"src/my/model.ts\" modelExport=\"MyModel\" ddlPath=\"src/my/ddl.ts\""
```

## Integration with EDIN

Use ADAL during the **Experiment** phase to validate schema alignment before implementation:

1. Run ADAL on the target domain
2. Document discrepancies in the Brief
3. Plan DDL migrations or Schema updates in Design phase
4. Implement fixes
5. Re-run ADAL to verify alignment in Negotiate phase
