import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

export const DeviceStatusSchema = Schema.Literal(
  'provisioned',
  'online',
  'offline',
  'faulted',
  'firmware_update',
  'decommissioned'
).annotations({
  identifier: 'DeviceStatus',
  title: 'Device Status',
  description: 'ISA-95 control-module lifecycle status for device assets.',
});

export type DeviceStatus = typeof DeviceStatusSchema.Type;

export const DeviceTypeSchema = Schema.Literal(
  'motor',
  'valve',
  'pump',
  'heater',
  'cooler',
  'conveyor',
  'actuator',
  'servo',
  'relay',
  'vfd',
  'solenoid',
  'gripper',
  'light',
  'alarm',
  'other'
).annotations({
  identifier: 'DeviceType',
  title: 'Device Type',
  description: 'Industrial actuator category for ISA-95 level-0 devices.',
});

export type DeviceType = typeof DeviceTypeSchema.Type;

export const ControlModeSchema = Schema.Literal(
  'manual',
  'auto',
  'remote',
  'local'
).annotations({
  identifier: 'DeviceControlMode',
  title: 'Device Control Mode',
  description: 'Operational authority mode for device command handling.',
});

export type ControlMode = typeof ControlModeSchema.Type;

export const PowerUnitSchema = Schema.Literal(
  'watts',
  'kilowatts',
  'horsepower'
).annotations({
  identifier: 'DevicePowerUnit',
  title: 'Device Power Unit',
  description: 'Rated power unit for actuator assets.',
});

export type PowerUnit = typeof PowerUnitSchema.Type;

export const DeviceTransitionActionSchema = Schema.Literal(
  'GoOnline',
  'GoOffline',
  'MarkFaulted',
  'ClearFault',
  'StartFirmwareUpdate',
  'CompleteFirmwareUpdate',
  'FailFirmwareUpdate',
  'Decommission'
).annotations({
  identifier: 'DeviceTransitionAction',
  title: 'Device Transition Action',
  description: 'Named transition actions from the canonical device lifecycle graph.',
});

export type DeviceTransitionAction = typeof DeviceTransitionActionSchema.Type;

export const DEVICE_ID_PATTERN = /^DEV-[a-zA-Z0-9-]+$/;
export const MACHINE_ID_PATTERN = /^MCH-[a-zA-Z0-9-]+$/;
export const WORK_CELL_ID_PATTERN = /^WCL-[a-zA-Z0-9-]+$/;

export const DeviceIdSchema = Schema.String.pipe(Schema.pattern(DEVICE_ID_PATTERN)).annotations({
  identifier: 'DeviceId',
  title: 'Device ID',
  description: 'Device identifier in DEV-{slug} format.',
});

export type DeviceId = typeof DeviceIdSchema.Type;

export const MachineIdSchema = Schema.String.pipe(
  Schema.pattern(MACHINE_ID_PATTERN)
).annotations({
  identifier: 'MachineId',
  title: 'Machine ID',
  description: 'Machine identifier in MCH-{slug} format.',
});

export type MachineId = typeof MachineIdSchema.Type;

export const WorkCellIdSchema = Schema.String.pipe(
  Schema.pattern(WORK_CELL_ID_PATTERN)
).annotations({
  identifier: 'WorkCellId',
  title: 'WorkCell ID',
  description: 'WorkCell identifier in WCL-{slug} format.',
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

export const DeviceLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'DeviceLocation',
  title: 'Device Location',
  description: 'Physical location details for level-0 device assets.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'DeviceMetadata',
  title: 'Device Metadata',
  description: 'Extensible metadata map for device payloads.',
});

/**
 * Canonical device payload contract derived from src/lib/iiot/schemas/assets/device/schema.ts.
 */
export const DeviceSchema = Schema.Struct({
  device_id: DeviceIdSchema,
  name: Schema.NonEmptyString,
  status: DeviceStatusSchema,
  device_type: DeviceTypeSchema,
  control_mode: Schema.NullOr(ControlModeSchema),
  rated_power: Schema.NullOr(Schema.Number.pipe(Schema.positive())),
  power_unit: Schema.NullOr(PowerUnitSchema),
  last_command_at: NullableTimestamp,
  opc_ua_node_id: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(DeviceLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  enterprise_id: Schema.NullOr(Schema.String),
  site_id: Schema.NullOr(Schema.String),
  area_id: Schema.NullOr(Schema.String),
  plant_id: Schema.NullOr(Schema.String),
  line_id: Schema.NullOr(Schema.String),
  work_cell_id: Schema.NullOr(WorkCellIdSchema),
  machine_id: Schema.NullOr(MachineIdSchema),
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Device',
  title: 'Device',
  description:
    'Canonical device payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Device = typeof DeviceSchema.Type;

export const DeviceAgentStateSchema = DeviceSchema.annotations({
  identifier: 'DeviceAgentState',
  title: 'Device Agent State',
  description: 'Canonical Jido agent-state contract for Device runtime.',
});

export type DeviceAgentState = typeof DeviceAgentStateSchema.Type;

export const DeviceTransitionEventSchema = Schema.Struct({
  device_id: DeviceIdSchema,
  from: DeviceStatusSchema,
  to: DeviceStatusSchema,
  action: Schema.optional(Schema.NullOr(DeviceTransitionActionSchema)),
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'DeviceTransitionEvent',
  title: 'Device Transition Event',
  description: 'Transition payload contract for device lifecycle events.',
});

export type DeviceTransitionEvent = typeof DeviceTransitionEventSchema.Type;

export const transitions = {
  provisioned: ['online'],
  online: ['offline', 'faulted', 'firmware_update'],
  offline: ['online', 'faulted', 'firmware_update', 'decommissioned'],
  faulted: ['offline', 'decommissioned'],
  firmware_update: ['online', 'offline'],
  decommissioned: [],
} as const satisfies Readonly<Record<DeviceStatus, readonly DeviceStatus[]>>;

export const deviceStates: ReadonlyArray<DeviceStatus> = [
  'provisioned',
  'online',
  'offline',
  'faulted',
  'firmware_update',
  'decommissioned',
];

export const isLegalTransition = (from: DeviceStatus, to: DeviceStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<DeviceStatus, readonly DeviceStatus[]>> = transitions
): string => toMermaidFor(graph, deviceStates);

export interface MakeDeviceInput {
  readonly slug: string;
  readonly name: string;
  readonly status: DeviceStatus;
  readonly device_type: DeviceType;
  readonly hierarchy_path: string;
  readonly created_at: string;
  readonly control_mode?: ControlMode | null;
  readonly rated_power?: number | null;
  readonly power_unit?: PowerUnit | null;
  readonly last_command_at?: string | null;
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

export interface MakeDeviceTransitionEventInput {
  readonly slug: string;
  readonly from: DeviceStatus;
  readonly to: DeviceStatus;
  readonly at: string;
  readonly action?: DeviceTransitionAction | null;
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

export const makeDeviceId = (slug: string): DeviceId => {
  const candidate = `DEV-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(DeviceIdSchema)(candidate);
};

export const makeDevice = (input: MakeDeviceInput): Device =>
  Schema.decodeUnknownSync(DeviceSchema)({
    device_id: makeDeviceId(input.slug),
    name: input.name,
    status: input.status,
    device_type: input.device_type,
    control_mode: input.control_mode ?? null,
    rated_power: input.rated_power ?? null,
    power_unit: input.power_unit ?? null,
    last_command_at: input.last_command_at ?? null,
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

export const makeDeviceTransitionEvent = (
  input: MakeDeviceTransitionEventInput
): DeviceTransitionEvent =>
  Schema.decodeUnknownSync(DeviceTransitionEventSchema)({
    device_id: makeDeviceId(input.slug),
    from: input.from,
    to: input.to,
    action: input.action ?? null,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodeDeviceSync = Schema.decodeUnknownSync(DeviceSchema);
export const decodeDeviceAgentStateSync = Schema.decodeUnknownSync(DeviceAgentStateSchema);
export const decodeDeviceTransitionEventSync =
  Schema.decodeUnknownSync(DeviceTransitionEventSchema);
