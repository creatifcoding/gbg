# IIoT Schemas Research

**Generated:** 2026-01-25  
**Location:** `src/lib/iiot/schemas/`  
**Purpose:** Exhaustive documentation of Effect Schema patterns in IIoT domain

---

## 1. Branded Identifier Patterns

### Pattern: `Schema.String.pipe(Schema.brand())`

All domain identifiers use branded strings for type safety at compile time.

**Implementation:**
```typescript
// src/lib/iiot/schemas/identifiers.ts

/** Plant identifier (e.g., 'PLANT-A') */
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>

/** Production line identifier (e.g., 'LINE-001') */
export const LineId = Schema.String.pipe(Schema.brand('LineId'))
export type LineId = Schema.Schema.Type<typeof LineId>

/** Machine identifier (e.g., 'MCH-001') */
export const MachineId = Schema.String.pipe(Schema.brand('MachineId'))
export type MachineId = Schema.Schema.Type<typeof MachineId>

/** Sensor/device identifier (e.g., 'TMP-001') */
export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
export type DeviceId = Schema.Schema.Type<typeof DeviceId>

/** Alarm identifier (e.g., 'ALM-abc123') */
export const AlarmId = Schema.String.pipe(Schema.brand('AlarmId'))
export type AlarmId = Schema.Schema.Type<typeof AlarmId>
```

**Key Characteristics:**
- Runtime representation: plain `string`
- Compile-time: distinct types (cannot mix PlantId with LineId)
- No additional validation (just type branding)
- Double-export pattern: schema + type

**Usage in Tests:**
```typescript
// Encoding/decoding is transparent
const result = Schema.decodeUnknownSync(PlantId)('PLANT-001')
expect(result).toBe('PLANT-001')

// Invalid types rejected at runtime
expect(() => Schema.decodeUnknownSync(PlantId)(123)).toThrow()
expect(() => Schema.decodeUnknownSync(DeviceId)(null)).toThrow()
```

**Pattern Benefits:**
1. Type-safe at compile time (prevents ID mix-ups)
2. Zero runtime overhead (just strings)
3. Clear domain semantics
4. Works with Effect validation/parsing

---

## 2. Schema.TaggedClass for Domain Entities

### Pattern: `Schema.TaggedClass<T>()('Tag', { fields })`

All domain entities use `TaggedClass` for discriminated unions and structural typing.

### 2.1 Basic Asset Entities

**Plant:**
```typescript
// src/lib/iiot/schemas/assets.ts

/** Manufacturing plant */
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}
```

**Line:**
```typescript
/** Production line within a plant */
export class Line extends Schema.TaggedClass<Line>()('Line', {
  id: LineId,
  name: Schema.NonEmptyString,
  plantId: PlantId,  // FK to Plant
}) {}
```

**Machine:**
```typescript
/** Machine/equipment within a production line */
export class Machine extends Schema.TaggedClass<Machine>()('Machine', {
  id: MachineId,
  name: Schema.NonEmptyString,
  model: Schema.optional(Schema.String),
  lineId: LineId,  // FK to Line
}) {}
```

**Sensor:**
```typescript
/** Sensor monitoring a machine */
export class Sensor extends Schema.TaggedClass<Sensor>()('Sensor', {
  deviceId: DeviceId,
  type: SensorType,           // Literal enum
  unit: MeasurementUnit,      // Literal enum
  machineId: MachineId,       // FK to Machine
}) {}
```

**Key Characteristics:**
- Every class has `_tag` discriminant (auto-added)
- Mix of branded IDs, literals, and built-in schemas
- Foreign key relationships via branded IDs
- Optional fields via `Schema.optional()`

### 2.2 Time-Series Entities

**SensorReading:**
```typescript
// src/lib/iiot/schemas/readings.ts

/** Raw sensor reading from TimescaleDB hypertable */
export class SensorReading extends Schema.TaggedClass<SensorReading>()('SensorReading', {
  time: Schema.DateTimeUtc,
  deviceId: DeviceId,
  value: Schema.Number,
  quality: QualityScore,  // Branded number with constraints
}) {}
```

**AggregatedReading:**
```typescript
/** Aggregated reading (from continuous aggregates) */
export class AggregatedReading extends Schema.TaggedClass<AggregatedReading>()('AggregatedReading', {
  bucket: Schema.DateTimeUtc,
  deviceId: DeviceId,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddevValue: Schema.optional(Schema.Number),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}
```

**AnalyticsRecord:**
```typescript
/** Historical analytics record (from pg_mooncake columnstore) */
export class AnalyticsRecord extends Schema.TaggedClass<AnalyticsRecord>()('AnalyticsRecord', {
  deviceId: DeviceId,
  hour: Schema.DateTimeUtc,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddev: Schema.optional(Schema.Number),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}
```

### 2.3 Alarm Entities

**Alarm:**
```typescript
// src/lib/iiot/schemas/alarms.ts

/** Alarm record from database */
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  
  // nullable: true allows NULL from database to decode as undefined
  message: Schema.optionalWith(Schema.String, { nullable: true }),
  triggeredAt: Schema.DateTimeUtc,
  acknowledgedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  clearedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  acknowledgedBy: Schema.optionalWith(Schema.String, { nullable: true }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }), 
    { nullable: true }
  ),
}) {}
```

**AlarmContext:**
```typescript
/** Reading context around an alarm (from materialized view) */
export class AlarmContext extends Schema.TaggedClass<AlarmContext>()('AlarmContext', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  readingTime: Schema.DateTimeUtc,
  value: Schema.Number,
  quality: Schema.Number,
  offsetSeconds: Schema.Number, // seconds from alarm trigger (negative = before)
}) {}
```

**Key Pattern for Database Entities:**
- Use `Schema.optionalWith(T, { nullable: true })` for DB NULL fields
- Maps `NULL` → `undefined` on decode
- Maps `undefined` → `NULL` on encode
- Different from `Schema.optional()` which omits the field

---

## 3. Schema.Literal for Enums/Unions

All string unions use `Schema.Literal()` for exhaustive type checking.

### 3.1 Asset Domain Literals

**SensorType:**
```typescript
// src/lib/iiot/schemas/assets.ts

/** Supported sensor measurement types */
export const SensorType = Schema.Literal(
  'temperature',
  'vibration',
  'humidity',
  'speed',
  'current',
  'pressure',
  'flow',
  'level'
)
export type SensorType = Schema.Schema.Type<typeof SensorType>
```

**MeasurementUnit:**
```typescript
/** Measurement unit strings */
export const MeasurementUnit = Schema.Literal(
  'celsius',
  'fahrenheit',
  'mm/s',
  'percent',
  'm/min',
  'amps',
  'psi',
  'bar',
  'l/min',
  'gpm',
  'meters',
  'feet'
)
export type MeasurementUnit = Schema.Schema.Type<typeof MeasurementUnit>
```

### 3.2 Alarm Domain Literals

**AlarmSeverity:**
```typescript
// src/lib/iiot/schemas/alarms.ts

/** Alarm severity levels */
export const AlarmSeverity = Schema.Literal('info', 'warning', 'critical', 'emergency')
export type AlarmSeverity = Schema.Schema.Type<typeof AlarmSeverity>
```

**AlarmType:**
```typescript
/** Alarm type categories */
export const AlarmType = Schema.Literal(
  'high_temperature',
  'low_temperature',
  'high_vibration',
  'overcurrent',
  'undercurrent',
  'high_pressure',
  'low_pressure',
  'high_humidity',
  'low_humidity',
  'speed_deviation',
  'communication_loss',
  'sensor_fault',
  'maintenance_due',
  'custom'
)
export type AlarmType = Schema.Schema.Type<typeof AlarmType>
```

### 3.3 Time-Series Literals

**TimeBucket:**
```typescript
// src/lib/iiot/schemas/readings.ts

/** Time bucket granularity for aggregation queries */
export const TimeBucket = Schema.Literal('1min', '5min', '15min', '1hour', '1day')
export type TimeBucket = Schema.Schema.Type<typeof TimeBucket>
```

**Key Characteristics:**
- Compile-time exhaustiveness checking
- Runtime validation (rejects invalid strings)
- Works seamlessly with TaggedClass fields
- Double-export pattern for schema + type

---

## 4. Schema.optional vs Schema.optionalWith Patterns

### 4.1 `Schema.optional()` - Field May Be Absent

Used when the field is truly optional and may not be present at all.

**Example:**
```typescript
// Plant.location is optional - can be omitted entirely
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),  // Can be omitted
}) {}

// Machine.model is optional
export class Machine extends Schema.TaggedClass<Machine>()('Machine', {
  id: MachineId,
  name: Schema.NonEmptyString,
  model: Schema.optional(Schema.String),     // Can be omitted
  lineId: LineId,
}) {}

// AggregatedReading.stddevValue is optional
export class AggregatedReading extends Schema.TaggedClass<AggregatedReading>()('AggregatedReading', {
  bucket: Schema.DateTimeUtc,
  deviceId: DeviceId,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddevValue: Schema.optional(Schema.Number),  // Can be omitted
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}
```

**Behavior:**
- Decode: Missing field → `undefined`
- Encode: `undefined` → field omitted from output
- Does NOT handle `null` from database

### 4.2 `Schema.optionalWith(T, { nullable: true })` - NULL from Database

Used when decoding from database columns that can be `NULL`.

**Example:**
```typescript
// Alarm fields that map to nullable DB columns
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  
  // Database NULL → undefined
  message: Schema.optionalWith(Schema.String, { nullable: true }),
  triggeredAt: Schema.DateTimeUtc,
  acknowledgedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  clearedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  acknowledgedBy: Schema.optionalWith(Schema.String, { nullable: true }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }), 
    { nullable: true }
  ),
}) {}
```

**Behavior:**
- Decode: `null` → `undefined`, missing field → `undefined`
- Encode: `undefined` → `NULL`
- Critical for PostgreSQL nullable columns

**Rule:**
- Use `Schema.optional()` for domain schemas (pure TypeScript)
- Use `Schema.optionalWith(T, { nullable: true })` for database schemas

---

## 5. Error Schema Patterns (Data.TaggedError)

All IIoT errors use `Data.TaggedError` for type-safe error handling.

### 5.1 Database Errors

```typescript
// src/lib/iiot/schemas/errors.ts

/** Error connecting to the IIoT database */
export class IIoTConnectionError extends Data.TaggedError('IIoTConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** Error executing a query */
export class IIoTQueryError extends Data.TaggedError('IIoTQueryError')<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}> {}
```

### 5.2 Sensor Errors

```typescript
/** Sensor/device not found */
export class DeviceNotFoundError extends Data.TaggedError('DeviceNotFoundError')<{
  readonly deviceId: DeviceId
}> {}

/** Invalid sensor reading */
export class InvalidReadingError extends Data.TaggedError('InvalidReadingError')<{
  readonly deviceId: DeviceId
  readonly message: string
  readonly value?: number
}> {}
```

### 5.3 Asset Errors

```typescript
/** Machine not found in asset hierarchy */
export class MachineNotFoundError extends Data.TaggedError('MachineNotFoundError')<{
  readonly machineId: MachineId
}> {}

/** Plant not found in asset hierarchy */
export class PlantNotFoundError extends Data.TaggedError('PlantNotFoundError')<{
  readonly plantId: PlantId
}> {}

/** Asset hierarchy traversal error */
export class HierarchyError extends Data.TaggedError('HierarchyError')<{
  readonly message: string
  readonly cause?: unknown
}> {}
```

### 5.4 Alarm Errors

```typescript
/** Alarm not found */
export class AlarmNotFoundError extends Data.TaggedError('AlarmNotFoundError')<{
  readonly alarmId: AlarmId
}> {}

/** Alarm already acknowledged */
export class AlarmAlreadyAcknowledgedError extends Data.TaggedError('AlarmAlreadyAcknowledgedError')<{
  readonly alarmId: AlarmId
}> {}

/** Alarm already cleared */
export class AlarmAlreadyClearedError extends Data.TaggedError('AlarmAlreadyClearedError')<{
  readonly alarmId: AlarmId
}> {}
```

### 5.5 Graph Errors

```typescript
/** Error executing Cypher query on Apache AGE */
export class GraphQueryError extends Data.TaggedError('GraphQueryError')<{
  readonly query: string
  readonly message: string
  readonly cause?: unknown
}> {}
```

### 5.6 Error Union Type

```typescript
/** All IIoT service errors */
export type IIoTServiceError =
  | IIoTConnectionError
  | IIoTQueryError
  | DeviceNotFoundError
  | InvalidReadingError
  | MachineNotFoundError
  | PlantNotFoundError
  | HierarchyError
  | AlarmNotFoundError
  | AlarmAlreadyAcknowledgedError
  | AlarmAlreadyClearedError
  | GraphQueryError
```

**Key Characteristics:**
- Use `Data.TaggedError()` not `Schema.TaggedError`
- Generic parameter is the error shape
- All fields should be `readonly`
- `cause?: unknown` for wrapped errors
- Union type for exhaustive error handling

**Pattern:**
1. Specific error classes with relevant context
2. Domain-specific errors (device, machine, alarm)
3. Infrastructure errors (connection, query, graph)
4. Union type for service error signatures

---

## 6. Relationship Between Schemas and Models

The codebase follows a **schema-first, model-derived** pattern.

### 6.1 Separation of Concerns

| Layer | Purpose | Location | Responsibility |
|-------|---------|----------|----------------|
| **Schema** | Domain types | `schemas/` | Business logic validation, runtime types |
| **Model** | DB persistence | `models/` | PostgreSQL mapping, DB-specific transforms |

### 6.2 Model Derives from Schema

Models **extend** schemas with DB-specific transforms.

**Example: Plant**

```typescript
// schemas/assets.ts - Domain schema
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}

// models/assets/PlantModel.ts - DB model
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  // Derived from Plant.fields - direct reuse
  name: Plant.fields.name,

  // Derived with Model-specific transforms
  id: Model.GeneratedByApp(PlantId),         // Add GeneratedByApp modifier
  location: Model.FieldOption(Schema.String), // Schema.optional → Model.FieldOption

  // DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
```

**Key Pattern:**
- Reuse `Plant.fields.name` directly
- Transform optional fields: `Schema.optional()` → `Model.FieldOption()`
- Transform IDs: add `Model.GeneratedByApp()` or `Model.Generated()`
- Add DB-only fields (`createdAt`, `updatedAt`)

**Example: Alarm**

```typescript
// schemas/alarms.ts - Domain schema
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optionalWith(Schema.String, { nullable: true }),
  triggeredAt: Schema.DateTimeUtc,
  acknowledgedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  clearedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  acknowledgedBy: Schema.optionalWith(Schema.String, { nullable: true }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }), 
    { nullable: true }
  ),
}) {}

// models/alarms/AlarmModel.ts - DB model
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  // Derived from Alarm.fields - direct reuse
  deviceId: Alarm.fields.deviceId,
  alarmType: Alarm.fields.alarmType,
  severity: Alarm.fields.severity,

  // Derived with Model-specific transforms
  id: Model.Generated(AlarmId),                         // Auto-generated
  message: Model.FieldOption(Schema.String),            // NULL ↔ Option
  triggeredAt: CreatedAt,                               // DateTimeUtc → pg Date
  acknowledgedAt: Model.FieldOption(Schema.DateFromSelf), // pg returns native Date
  clearedAt: Model.FieldOption(Schema.DateFromSelf),      // pg returns native Date
  acknowledgedBy: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,                           // JSONB handling
}) {}
```

**Key Transforms:**
- `Schema.DateTimeUtc` → `Schema.DateFromSelf` (pg driver returns native Date objects)
- `Schema.optionalWith(T, { nullable: true })` → `Model.FieldOption(T)`
- `AlarmId` → `Model.Generated(AlarmId)` (auto-generated in DB)
- Metadata → `OptionalMetadata` (JSONB transform)

**Example: SensorReading (Composite Key)**

```typescript
// schemas/readings.ts - Domain schema
export class SensorReading extends Schema.TaggedClass<SensorReading>()('SensorReading', {
  time: Schema.DateTimeUtc,
  deviceId: DeviceId,
  value: Schema.Number,
  quality: QualityScore,
}) {}

// models/readings/SensorReadingModel.ts - DB model
export class SensorReadingModel extends Model.Class<SensorReadingModel>('SensorReadingModel')({
  // Derived from SensorReading.fields - with pg Date transform
  time: Schema.DateFromSelf,                      // pg driver returns native Date
  deviceId: SensorReading.fields.deviceId,
  value: SensorReading.fields.value,
  quality: SensorReading.fields.quality,
}) {}
```

**Note:** Composite PK `(time, deviceId)` requires manual repository (no auto-generation).

### 6.3 Common Model Transforms

Defined in `models/_common.ts`:

```typescript
// JSON Transforms
export const JsonFromString = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Model.JsonFromString(schema)

export const MetadataRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })

// For JSONB columns (pg returns parsed objects, not strings)
export const OptionalMetadata = Model.FieldOption(MetadataRecord)

// Timestamp Helpers
export const CreatedAt = Model.DateTimeInsertFromDate  // Set on insert
export const UpdatedAt = Model.DateTimeUpdateFromDate  // Updated on modify
```

**Key Insight:**
- PostgreSQL JSONB columns return **parsed objects**, not strings
- Use `Model.FieldOption(MetadataRecord)` directly (not `JsonFromString`)
- `JsonFromString` is only for TEXT columns storing JSON

### 6.4 Field Reuse Pattern

```typescript
// ✅ GOOD: Reuse schema fields directly
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Plant.fields.name,  // Reuse domain field
  // ...
}) {}

// ❌ BAD: Redefine schema
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Schema.NonEmptyString,  // Duplication!
  // ...
}) {}
```

**Benefits of Reuse:**
- Single source of truth (domain schema)
- Changes propagate automatically
- Reduces duplication
- Clear derivation relationship

---

## 7. Validation Patterns

### 7.1 Runtime Validation via Schemas

All schemas provide runtime validation through Effect's decode/encode.

**Example: Branded Number with Constraints**

```typescript
// src/lib/iiot/schemas/readings.ts

/** Data quality score (0-100, where 100 is highest quality) */
export const QualityScore = Schema.Number.pipe(
  Schema.int(),            // Must be integer
  Schema.between(0, 100),  // Range constraint
  Schema.brand('QualityScore')
)
export type QualityScore = Schema.Schema.Type<typeof QualityScore>
```

**Test:**
```typescript
// Valid values
expect(Schema.decodeUnknownSync(QualityScore)(0)).toBe(0)
expect(Schema.decodeUnknownSync(QualityScore)(50)).toBe(50)
expect(Schema.decodeUnknownSync(QualityScore)(100)).toBe(100)

// Invalid values
expect(() => Schema.decodeUnknownSync(QualityScore)(-1)).toThrow()
expect(() => Schema.decodeUnknownSync(QualityScore)(101)).toThrow()
```

**Example: Positive Integer with Pipe**

```typescript
sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive())
```

### 7.2 TaggedClass Validation

TaggedClass provides structural validation including the `_tag` field.

**Example:**
```typescript
const data = {
  _tag: 'Plant' as const,
  id: 'PLANT-001',
  name: 'Chicago Assembly',
  location: 'Chicago, IL',
}

const result = Schema.decodeUnknownSync(Plant)(data)
expect(result._tag).toBe('Plant')
expect(result.name).toBe('Chicago Assembly')
```

**Automatic Features:**
- `_tag` discriminant added automatically
- Runtime validation of all fields
- Optional field handling
- Nested schema validation

### 7.3 Literal Validation

Literals provide exhaustive runtime validation.

**Example:**
```typescript
const validTypes = ['temperature', 'vibration', 'humidity', 'speed', 'current', 'pressure', 'flow', 'level']

validTypes.forEach((type) => {
  expect(Schema.decodeUnknownSync(SensorType)(type)).toBe(type)
})

// Invalid values rejected
expect(() => Schema.decodeUnknownSync(SensorType)('invalid_type')).toThrow()
```

### 7.4 Struct Validation (Query Params)

Parameter objects use `Schema.Struct` for validation.

**Example:**
```typescript
// src/lib/iiot/schemas/alarms.ts

export const AlarmQueryParams = Schema.Struct({
  deviceId: Schema.optional(DeviceId),
  severity: Schema.optional(AlarmSeverity),
  onlyOpen: Schema.optional(Schema.Boolean),
  since: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type AlarmQueryParams = Schema.Schema.Type<typeof AlarmQueryParams>
```

**Key Pattern:**
- All fields optional (for flexible queries)
- Constrained fields (limit must be positive integer)
- Type-safe branded IDs
- DateTime handling

**More Examples:**

```typescript
// Time-series query
export const TimeSeriesQueryParams = Schema.Struct({
  deviceId: DeviceId,
  since: Schema.optional(Schema.DateTimeUtc),
  until: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})

// Aggregation query
export const AggregatedQueryParams = Schema.Struct({
  deviceId: DeviceId,
  bucket: TimeBucket,
  since: Schema.optional(Schema.DateTimeUtc),
  until: Schema.optional(Schema.DateTimeUtc),
})

// Batch insert
export const InsertReadingsParams = Schema.Struct({
  readings: Schema.Array(
    Schema.Struct({
      time: Schema.DateTimeUtc,
      deviceId: DeviceId,
      value: Schema.Number,
      quality: Schema.optional(QualityScore),
    })
  ),
})
```

---

## 8. Composite/Hierarchical Schemas

The codebase defines **denormalized hierarchy schemas** for efficient queries.

### 8.1 Hierarchy Pattern

**SensorHierarchy (Full Path):**
```typescript
/** Full sensor hierarchy path */
export class SensorHierarchy extends Schema.TaggedClass<SensorHierarchy>()('SensorHierarchy', {
  deviceId: DeviceId,
  machineName: Schema.String,
  lineName: Schema.String,
  plantName: Schema.String,
}) {}
```

**MachineWithSensors (Composition):**
```typescript
/** Machine with its sensors */
export class MachineWithSensors extends Schema.TaggedClass<MachineWithSensors>()('MachineWithSensors', {
  machine: Machine,
  sensors: Schema.Array(Sensor),
}) {}
```

**LineWithMachines (Nested Composition):**
```typescript
/** Line with its machines */
export class LineWithMachines extends Schema.TaggedClass<LineWithMachines>()('LineWithMachines', {
  line: Line,
  machines: Schema.Array(MachineWithSensors),
}) {}
```

**PlantHierarchy (Full Tree):**
```typescript
/** Plant with its complete hierarchy */
export class PlantHierarchy extends Schema.TaggedClass<PlantHierarchy>()('PlantHierarchy', {
  plant: Plant,
  lines: Schema.Array(LineWithMachines),
}) {}
```

**Key Pattern:**
- Compose schemas from other schemas
- Use `Schema.Array()` for collections
- Nested TaggedClass instances
- Denormalized for query efficiency

**Hierarchy Structure:**
```
PlantHierarchy
├── plant: Plant
└── lines: LineWithMachines[]
    ├── line: Line
    └── machines: MachineWithSensors[]
        ├── machine: Machine
        └── sensors: Sensor[]
```

---

## 9. Code Examples from Implementation

### 9.1 Creating Domain Entities

```typescript
// From tests
const plant = Schema.decodeUnknownSync(Plant)({
  _tag: 'Plant',
  id: 'PLANT-001',
  name: 'Chicago Assembly',
  location: 'Chicago, IL',
})

const sensor = Schema.decodeUnknownSync(Sensor)({
  _tag: 'Sensor',
  deviceId: 'TMP-001',
  machineId: 'MCH-001',
  type: 'temperature',
  unit: 'celsius',
})
```

### 9.2 Optional Field Handling

```typescript
// With model field
const withModel = Schema.decodeUnknownSync(Machine)({
  _tag: 'Machine',
  id: 'MCH-001',
  name: 'Welding Robot',
  lineId: 'LINE-001',
  model: 'FANUC R-2000',
})

// Without model field
const withoutModel = Schema.decodeUnknownSync(Machine)({
  _tag: 'Machine',
  id: 'MCH-002',
  name: 'Press',
  lineId: 'LINE-001',
})

expect(withModel.model).toBe('FANUC R-2000')
expect(withoutModel.model).toBeUndefined()
```

### 9.3 Constrained Value Validation

```typescript
// Quality score with range constraint
const quality: QualityScore = Schema.decodeUnknownSync(QualityScore)(95)

// Sample count with positive integer constraint
const aggregated = Schema.decodeUnknownSync(AggregatedReading)({
  _tag: 'AggregatedReading',
  bucket: new Date(),
  deviceId: 'TMP-001',
  avgValue: 72.5,
  minValue: 70.0,
  maxValue: 75.0,
  sampleCount: 120,  // Must be positive integer
})
```

### 9.4 Enum/Literal Validation

```typescript
// Valid sensor types
const validTypes = ['temperature', 'vibration', 'humidity', 'speed', 'current', 'pressure', 'flow', 'level']
validTypes.forEach((type) => {
  const validated = Schema.decodeUnknownSync(SensorType)(type)
  expect(validated).toBe(type)
})

// Invalid type rejected
expect(() => Schema.decodeUnknownSync(SensorType)('invalid_type')).toThrow()

// Valid severity levels
const validSeverities = ['info', 'warning', 'critical', 'emergency']
validSeverities.forEach((severity) => {
  const validated = Schema.decodeUnknownSync(AlarmSeverity)(severity)
  expect(validated).toBe(severity)
})
```

---

## 10. Patterns to Preserve for v3

### 10.1 Core Patterns (Must Preserve)

1. **Branded Identifiers**
   - `Schema.String.pipe(Schema.brand('TypeName'))`
   - Double export (schema + type)
   - Zero runtime overhead

2. **TaggedClass for Entities**
   - `Schema.TaggedClass<T>()('Tag', { fields })`
   - Auto `_tag` discriminant
   - Structural validation

3. **Literal Enums**
   - `Schema.Literal('a', 'b', 'c')`
   - Exhaustive compile-time checking
   - Runtime validation

4. **Schema-First, Model-Derived**
   - Domain schemas in `schemas/`
   - DB models in `models/`
   - Field reuse: `DomainSchema.fields.fieldName`

5. **Two Optional Patterns**
   - `Schema.optional()` for pure domain
   - `Schema.optionalWith(T, { nullable: true })` for DB nulls

6. **Tagged Errors**
   - `Data.TaggedError('ErrorName')<{ fields }>`
   - Union types for service errors
   - `cause?: unknown` for wrapping

### 10.2 Validation Patterns

1. **Constrained Numbers**
   - `Schema.Number.pipe(Schema.int(), Schema.between(0, 100), Schema.brand('Name'))`

2. **Positive Integers**
   - `Schema.Number.pipe(Schema.int(), Schema.positive())`

3. **Non-Empty Strings**
   - `Schema.NonEmptyString`

4. **DateTime Handling**
   - Domain: `Schema.DateTimeUtc`
   - Model: `Schema.DateFromSelf` (pg driver compatibility)

### 10.3 Composition Patterns

1. **Array Fields**
   - `Schema.Array(ItemSchema)`

2. **Nested Entities**
   - Compose TaggedClass instances
   - Build hierarchies (PlantHierarchy example)

3. **Struct Parameters**
   - `Schema.Struct({ key: schema, ... })`
   - All optional for flexible queries

4. **Record Metadata**
   - `Schema.Record({ key: Schema.String, value: Schema.Unknown })`

### 10.4 Model Transform Patterns

1. **ID Generation**
   - `Model.Generated(BrandedId)` - auto-generated
   - `Model.GeneratedByApp(BrandedId)` - client-provided

2. **Optional Fields**
   - `Model.FieldOption(Schema)` - NULL ↔ Option

3. **DateTime Transforms**
   - `Model.DateTimeInsertFromDate` - CreatedAt
   - `Model.DateTimeUpdateFromDate` - UpdatedAt
   - `Schema.DateFromSelf` - pg Date objects

4. **JSONB Handling**
   - `Model.FieldOption(MetadataRecord)` for JSONB columns
   - NOT `JsonFromString` (that's for TEXT)

### 10.5 File Organization

```
schemas/
├── identifiers.ts       # All branded IDs
├── assets.ts            # Asset hierarchy schemas
├── readings.ts          # Time-series schemas
├── alarms.ts            # Alarm/event schemas
├── errors.ts            # Tagged errors
└── index.ts             # Re-exports

models/
├── _common.ts           # Shared transforms
├── assets/
│   ├── PlantModel.ts
│   ├── LineModel.ts
│   ├── MachineModel.ts
│   └── SensorModel.ts
├── readings/
│   ├── SensorReadingModel.ts
│   ├── AggregatedReadingModel.ts
│   └── AnalyticsRecordModel.ts
└── alarms/
    ├── AlarmModel.ts
    └── AlarmContextModel.ts
```

### 10.6 Naming Conventions

- **Schemas**: PascalCase class (e.g., `Plant`, `Alarm`)
- **Branded IDs**: PascalCase with `Id` suffix (e.g., `PlantId`)
- **Literals**: PascalCase type name (e.g., `SensorType`, `AlarmSeverity`)
- **Models**: PascalCase with `Model` suffix (e.g., `PlantModel`)
- **Errors**: PascalCase with `Error` suffix (e.g., `DeviceNotFoundError`)
- **Params**: PascalCase with `Params` suffix (e.g., `AlarmQueryParams`)

### 10.7 Export Pattern

```typescript
// Schema definition
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))

// Type export (same name)
export type PlantId = Schema.Schema.Type<typeof PlantId>
```

**Double export enables:**
- Use as schema: `Schema.decodeUnknownSync(PlantId)(...)`
- Use as type: `function foo(id: PlantId) { ... }`

---

## 11. Anti-Patterns (Avoid These)

### 11.1 Don't Mix Optional Patterns

```typescript
// ❌ BAD: Using Schema.optional for DB nullable field
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  message: Schema.optional(Schema.String),  // Won't handle NULL correctly
})

// ✅ GOOD: Use optionalWith for DB fields
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  message: Schema.optionalWith(Schema.String, { nullable: true }),
})
```

### 11.2 Don't Duplicate Schema Fields in Models

```typescript
// ❌ BAD: Redefining schema
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Schema.NonEmptyString,  // Duplication!
  location: Schema.optional(Schema.String),
})

// ✅ GOOD: Reuse from domain schema
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Plant.fields.name,
  location: Model.FieldOption(Schema.String),
})
```

### 11.3 Don't Use JsonFromString for JSONB

```typescript
// ❌ BAD: JSONB columns return objects, not strings
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  metadata: Model.JsonFromString(MetadataRecord),  // Wrong!
})

// ✅ GOOD: JSONB → parsed object
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  metadata: Model.FieldOption(MetadataRecord),
})
```

### 11.4 Don't Forget DateFromSelf in Models

```typescript
// ❌ BAD: DateTimeUtc incompatible with pg driver
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  triggeredAt: Schema.DateTimeUtc,  // Type mismatch!
})

// ✅ GOOD: pg returns native Date objects
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  triggeredAt: Schema.DateFromSelf,
})
```

### 11.5 Don't Create Branded Types Without Schema

```typescript
// ❌ BAD: Plain branded type (no runtime validation)
export type PlantId = string & { readonly PlantId: unique symbol }

// ✅ GOOD: Effect Schema brand (runtime validation)
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>
```

---

## 12. Summary

### Schema Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `identifiers.ts` | Branded IDs | PlantId, LineId, MachineId, DeviceId, AlarmId |
| `assets.ts` | Asset hierarchy | Plant, Line, Machine, Sensor, SensorType, MeasurementUnit |
| `readings.ts` | Time-series data | SensorReading, AggregatedReading, AnalyticsRecord, QualityScore, TimeBucket |
| `alarms.ts` | Alarms/events | Alarm, AlarmContext, AlarmSeverity, AlarmType, various Params |
| `errors.ts` | Domain errors | All TaggedError classes, IIoTServiceError union |
| `index.ts` | Re-exports | All of the above |

### Model Files

| Directory | Purpose | Pattern |
|-----------|---------|---------|
| `models/assets/` | Asset entities | Derive from `schemas/assets.ts` |
| `models/readings/` | Time-series | Derive from `schemas/readings.ts` |
| `models/alarms/` | Alarms | Derive from `schemas/alarms.ts` |
| `models/_common.ts` | Shared transforms | CreatedAt, UpdatedAt, OptionalMetadata, etc. |

### Key Principles

1. **Schemas define domain truth** - models derive from them
2. **Branded IDs everywhere** - type safety at zero cost
3. **TaggedClass for entities** - structural validation + discriminants
4. **Literal for enums** - exhaustive checking
5. **Two optional patterns** - domain vs. database
6. **Tagged errors** - type-safe error handling
7. **Field reuse** - DRY between schemas and models
8. **Composition over duplication** - build hierarchies from base schemas

---

**End of Research Document**
