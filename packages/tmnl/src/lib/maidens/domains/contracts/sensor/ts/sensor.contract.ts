import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical source map:
 * - src/lib/iiot/schemas/assets/sensor/schema.ts
 * - src/lib/iiot/schemas/assets/common/types.ts
 * - src/lib/iiot/machines/graphs/sensor-graph.ts
 */
export const SensorStatusSchema = Schema.Literal(
  'active',
  'calibrating',
  'needs_calibration',
  'faulted',
  'offline',
  'decommissioned'
).annotations({
  identifier: 'SensorStatus',
  title: 'Sensor Status',
  description: 'ISA-95 control-module lifecycle status for sensor assets.',
});

export type SensorStatus = typeof SensorStatusSchema.Type;

export const SensorTypeSchema = Schema.Literal(
  'temperature',
  'pressure',
  'vibration',
  'humidity',
  'flow',
  'level',
  'speed',
  'position',
  'current',
  'voltage',
  'power',
  'force',
  'torque',
  'weight',
  'ph',
  'conductivity',
  'other'
).annotations({
  identifier: 'SensorType',
  title: 'Sensor Type',
  description: 'Sensor measurement type classification from canonical IIoT schema.',
});

export type SensorType = typeof SensorTypeSchema.Type;

export const MeasurementUnitSchema = Schema.Literal(
  'celsius',
  'fahrenheit',
  'kelvin',
  'psi',
  'bar',
  'pascal',
  'kpa',
  'mm_s',
  'in_s',
  'g',
  'l_min',
  'gpm',
  'm3_h',
  'meters',
  'feet',
  'mm',
  'inches',
  'percent',
  'rpm',
  'ampere',
  'volt',
  'watt',
  'newton',
  'nm',
  'kg',
  'count',
  'unitless'
).annotations({
  identifier: 'MeasurementUnit',
  title: 'Measurement Unit',
  description: 'Measurement units supported by canonical sensor schema.',
});

export type MeasurementUnit = typeof MeasurementUnitSchema.Type;

export const SensorTransitionActionSchema = Schema.Literal(
  'StartCalibration',
  'CompleteCalibration',
  'FailCalibration',
  'FlagForCalibration',
  'MarkFaulted',
  'ClearFault',
  'TakeOffline',
  'BringOnline',
  'Decommission'
).annotations({
  identifier: 'SensorTransitionAction',
  title: 'Sensor Transition Action',
  description: 'Named transition actions from canonical sensor lifecycle graph.',
});

export type SensorTransitionAction = typeof SensorTransitionActionSchema.Type;

export const SENSOR_ID_PATTERN = /^SNS-[a-zA-Z0-9-]+$/;
export const MACHINE_ID_PATTERN = /^MCH-[a-zA-Z0-9-]+$/;

export const SensorIdSchema = Schema.String.pipe(Schema.pattern(SENSOR_ID_PATTERN)).annotations({
  identifier: 'SensorId',
  title: 'Sensor ID',
  description: 'Sensor identifier in SNS-{slug} format.',
});

export type SensorId = typeof SensorIdSchema.Type;

export const MachineIdSchema = Schema.String.pipe(
  Schema.pattern(MACHINE_ID_PATTERN)
).annotations({
  identifier: 'MachineId',
  title: 'Machine ID',
  description: 'Machine identifier in MCH-{slug} format.',
});

const IsoTimestampString = Schema.String.pipe(
  Schema.pattern(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
  )
).annotations({
  title: 'ISO8601 Timestamp',
  description: 'ISO8601 UTC or offset timestamp string.',
  jsonSchema: { format: 'date-time' },
});

const NullableTimestamp = Schema.Union(Schema.Null, IsoTimestampString).annotations({
  title: 'Nullable Timestamp',
  description: 'Timestamp value or null.',
});

export const SensorLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'SensorLocation',
  title: 'Sensor Location',
  description: 'Physical location details for level-0 sensor assets.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'SensorMetadata',
  title: 'Sensor Metadata',
  description: 'Extensible metadata map for sensor payloads.',
});

/**
 * Canonical sensor payload contract derived from src/lib/iiot/schemas/assets/sensor/schema.ts.
 */
export const SensorSchema = Schema.Struct({
  sensor_id: SensorIdSchema,
  name: Schema.NonEmptyString,
  status: SensorStatusSchema,
  sensor_type: SensorTypeSchema,
  unit: MeasurementUnitSchema,
  sample_rate_ms: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive())),
  threshold_high: Schema.NullOr(Schema.Number),
  threshold_critical: Schema.NullOr(Schema.Number),
  threshold_low: Schema.NullOr(Schema.Number),
  threshold_critical_low: Schema.NullOr(Schema.Number),
  last_calibration_date: NullableTimestamp,
  next_calibration_date: NullableTimestamp,
  opc_ua_node_id: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(SensorLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  enterprise_id: Schema.NullOr(Schema.String),
  site_id: Schema.NullOr(Schema.String),
  area_id: Schema.NullOr(Schema.String),
  plant_id: Schema.NullOr(Schema.String),
  line_id: Schema.NullOr(Schema.String),
  work_cell_id: Schema.NullOr(Schema.String),
  machine_id: Schema.NullOr(MachineIdSchema),
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Sensor',
  title: 'Sensor',
  description:
    'Canonical sensor payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Sensor = typeof SensorSchema.Type;

export const SensorAgentStateSchema = SensorSchema.annotations({
  identifier: 'SensorAgentState',
  title: 'Sensor Agent State',
  description: 'Canonical Jido agent-state contract for Sensor runtime.',
});

export type SensorAgentState = typeof SensorAgentStateSchema.Type;

export const SensorTransitionEventSchema = Schema.Struct({
  sensor_id: SensorIdSchema,
  from: SensorStatusSchema,
  to: SensorStatusSchema,
  action: Schema.optional(Schema.NullOr(SensorTransitionActionSchema)),
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'SensorTransitionEvent',
  title: 'Sensor Transition Event',
  description: 'Transition payload contract for sensor lifecycle events.',
});

export type SensorTransitionEvent = typeof SensorTransitionEventSchema.Type;

export const transitions = {
  active: ['calibrating', 'needs_calibration', 'faulted', 'offline'],
  calibrating: ['active', 'faulted'],
  needs_calibration: ['calibrating'],
  faulted: ['active', 'offline', 'decommissioned'],
  offline: ['active', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<SensorStatus, readonly SensorStatus[]>>;

export const sensorStates: ReadonlyArray<SensorStatus> = [
  'active',
  'calibrating',
  'needs_calibration',
  'faulted',
  'offline',
  'decommissioned',
];

export const isLegalTransition = (from: SensorStatus, to: SensorStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<SensorStatus, readonly SensorStatus[]>> = transitions
): string => toMermaidFor(graph, sensorStates);

export interface MakeSensorInput {
  readonly slug: string;
  readonly name: string;
  readonly status: SensorStatus;
  readonly sensor_type: SensorType;
  readonly unit: MeasurementUnit;
  readonly hierarchy_path: string;
  readonly created_at: string;
  readonly sample_rate_ms?: number | null;
  readonly threshold_high?: number | null;
  readonly threshold_critical?: number | null;
  readonly threshold_low?: number | null;
  readonly threshold_critical_low?: number | null;
  readonly last_calibration_date?: string | null;
  readonly next_calibration_date?: string | null;
  readonly opc_ua_node_id?: string | null;
  readonly description?: string | null;
  readonly location?: {
    readonly latitude?: number | null;
    readonly longitude?: number | null;
    readonly building?: string | null;
    readonly floor?: string | null;
    readonly zone?: string | null;
    readonly address?: string | null;
    readonly timezone?: string | null;
  } | null;
  readonly metadata?: Record<string, unknown>;
  readonly enterprise_id?: string | null;
  readonly site_id?: string | null;
  readonly area_id?: string | null;
  readonly plant_id?: string | null;
  readonly line_id?: string | null;
  readonly work_cell_id?: string | null;
  readonly machine_id?: string | null;
  readonly updated_at?: string | null;
}

export interface MakeSensorTransitionEventInput {
  readonly slug: string;
  readonly from: SensorStatus;
  readonly to: SensorStatus;
  readonly at: string;
  readonly action?: SensorTransitionAction | null;
  readonly reason?: string | null;
  readonly initiated_by?: string | null;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const makeSensorId = (slug: string): SensorId => {
  const candidate = `SNS-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(SensorIdSchema)(candidate);
};

export const makeSensor = (input: MakeSensorInput): Sensor =>
  Schema.decodeUnknownSync(SensorSchema)({
    sensor_id: makeSensorId(input.slug),
    name: input.name,
    status: input.status,
    sensor_type: input.sensor_type,
    unit: input.unit,
    sample_rate_ms: input.sample_rate_ms ?? null,
    threshold_high: input.threshold_high ?? null,
    threshold_critical: input.threshold_critical ?? null,
    threshold_low: input.threshold_low ?? null,
    threshold_critical_low: input.threshold_critical_low ?? null,
    last_calibration_date: input.last_calibration_date ?? null,
    next_calibration_date: input.next_calibration_date ?? null,
    opc_ua_node_id: input.opc_ua_node_id ?? null,
    description: input.description ?? null,
    location: input.location
      ? {
          latitude: input.location.latitude ?? null,
          longitude: input.location.longitude ?? null,
          building: input.location.building ?? null,
          floor: input.location.floor ?? null,
          zone: input.location.zone ?? null,
          address: input.location.address ?? null,
          timezone: input.location.timezone ?? null,
        }
      : null,
    metadata: input.metadata ?? {},
    hierarchy_path: input.hierarchy_path,
    enterprise_id: input.enterprise_id ?? null,
    site_id: input.site_id ?? null,
    area_id: input.area_id ?? null,
    plant_id: input.plant_id ?? null,
    line_id: input.line_id ?? null,
    work_cell_id: input.work_cell_id ?? null,
    machine_id: input.machine_id ?? null,
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makeSensorTransitionEvent = (
  input: MakeSensorTransitionEventInput
): SensorTransitionEvent =>
  Schema.decodeUnknownSync(SensorTransitionEventSchema)({
    sensor_id: makeSensorId(input.slug),
    from: input.from,
    to: input.to,
    action: input.action ?? null,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodeSensorSync = Schema.decodeUnknownSync(SensorSchema);
export const decodeSensorAgentStateSync = Schema.decodeUnknownSync(SensorAgentStateSchema);
export const decodeSensorTransitionEventSync =
  Schema.decodeUnknownSync(SensorTransitionEventSchema);
