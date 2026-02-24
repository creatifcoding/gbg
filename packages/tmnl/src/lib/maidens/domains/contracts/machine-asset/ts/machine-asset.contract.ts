import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical machine lifecycle status from src/lib/iiot/schemas/assets/machine/schema.ts.
 */
export const MachineAssetStatusSchema = Schema.Literal(
  'commissioned',
  'operational',
  'idle',
  'faulted',
  'scheduled_maintenance',
  'unscheduled_maintenance',
  'retired',
  'decommissioned'
).annotations({
  identifier: 'MachineAssetStatus',
  title: 'Machine Asset Status',
  description: 'ISA-95 machine lifecycle status.',
});

export type MachineAssetStatus = typeof MachineAssetStatusSchema.Type;

export const MACHINE_ASSET_ID_PATTERN = /^MCH-[a-zA-Z0-9-]+$/;

export const MachineAssetIdSchema = Schema.String.pipe(
  Schema.pattern(MACHINE_ASSET_ID_PATTERN)
).annotations({
  identifier: 'MachineAssetId',
  title: 'Machine Asset ID',
  description: 'Machine identifier in MCH-{slug} format.',
});

export type MachineAssetId = typeof MachineAssetIdSchema.Type;

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

export const MachineAssetLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'MachineAssetLocation',
  title: 'Machine Asset Location',
  description: 'Physical location details for a machine asset.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'MachineAssetMetadata',
  title: 'Machine Asset Metadata',
  description: 'Extensible metadata map for machine payloads.',
});

/**
 * Canonical machine payload contract derived from src/lib/iiot/schemas/assets/machine/schema.ts.
 */
export const MachineAssetSchema = Schema.Struct({
  machine_id: MachineAssetIdSchema,
  name: Schema.NonEmptyString,
  status: MachineAssetStatusSchema,
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(MachineAssetLocationSchema),
  metadata: MetadataSchema,
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
  hierarchy_path: Schema.String,
  enterprise_id: Schema.String,
  site_id: Schema.String,
  plant_id: Schema.String,
  line_id: Schema.String,
  work_cell_id: Schema.NullOr(Schema.String),
  machine_type: Schema.NonEmptyString,
  manufacturer: Schema.NullOr(Schema.String),
  model_number: Schema.NullOr(Schema.String),
  serial_number: Schema.NullOr(Schema.String),
  installation_date: NullableTimestamp,
  last_maintenance_date: NullableTimestamp,
  next_maintenance_date: NullableTimestamp,
}).annotations({
  identifier: 'MachineAsset',
  title: 'MachineAsset',
  description:
    'Canonical machine-asset payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type MachineAsset = typeof MachineAssetSchema.Type;

export const MachineAssetAgentStateSchema = MachineAssetSchema.annotations({
  identifier: 'MachineAssetAgentState',
  title: 'Machine Asset Agent State',
  description: 'Canonical Jido agent-state contract for MachineAsset runtime.',
});

export type MachineAssetAgentState = typeof MachineAssetAgentStateSchema.Type;

export const MachineAssetTransitionEventSchema = Schema.Struct({
  machine_id: MachineAssetIdSchema,
  from: MachineAssetStatusSchema,
  to: MachineAssetStatusSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
  notes: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'MachineAssetTransitionEvent',
  title: 'Machine Asset Transition Event',
  description: 'Transition payload contract for machine-asset lifecycle events.',
});

export type MachineAssetTransitionEvent = typeof MachineAssetTransitionEventSchema.Type;

/**
 * Canonical transitions mirrored from src/lib/iiot/machines/graphs/machine-asset-graph.ts.
 */
export const transitions = {
  commissioned: ['operational'],
  operational: ['idle', 'faulted', 'scheduled_maintenance', 'retired'],
  idle: ['operational', 'faulted', 'scheduled_maintenance', 'retired'],
  faulted: ['scheduled_maintenance', 'unscheduled_maintenance'],
  scheduled_maintenance: ['operational', 'decommissioned'],
  unscheduled_maintenance: ['operational'],
  retired: ['decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<MachineAssetStatus, readonly MachineAssetStatus[]>>;

export const machineAssetStates: ReadonlyArray<MachineAssetStatus> = [
  'commissioned',
  'operational',
  'idle',
  'faulted',
  'scheduled_maintenance',
  'unscheduled_maintenance',
  'retired',
  'decommissioned',
];

export const isLegalTransition = (
  from: MachineAssetStatus,
  to: MachineAssetStatus
): boolean => isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<MachineAssetStatus, readonly MachineAssetStatus[]>> = transitions
): string => toMermaidFor(graph, machineAssetStates);

export interface MakeMachineAssetInput {
  readonly slug: string;
  readonly name: string;
  readonly status?: MachineAssetStatus;
  readonly hierarchy_path: string;
  readonly enterprise_id: string;
  readonly site_id: string;
  readonly plant_id: string;
  readonly line_id: string;
  readonly work_cell_id?: string | null;
  readonly machine_type: string;
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
  readonly manufacturer?: string | null;
  readonly model_number?: string | null;
  readonly serial_number?: string | null;
  readonly installation_date?: string | null;
  readonly last_maintenance_date?: string | null;
  readonly next_maintenance_date?: string | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakeMachineAssetTransitionEventInput {
  readonly slug: string;
  readonly from: MachineAssetStatus;
  readonly to: MachineAssetStatus;
  readonly at: string;
  readonly reason?: string | null;
  readonly initiated_by?: string | null;
  readonly notes?: string | null;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const makeMachineAssetId = (slug: string): MachineAssetId => {
  const candidate = `MCH-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(MachineAssetIdSchema)(candidate);
};

export const makeMachineAsset = (input: MakeMachineAssetInput): MachineAsset =>
  Schema.decodeUnknownSync(MachineAssetSchema)({
    machine_id: makeMachineAssetId(input.slug),
    name: input.name,
    status: input.status ?? 'commissioned',
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
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
    hierarchy_path: input.hierarchy_path,
    enterprise_id: input.enterprise_id,
    site_id: input.site_id,
    plant_id: input.plant_id,
    line_id: input.line_id,
    work_cell_id: input.work_cell_id ?? null,
    machine_type: input.machine_type,
    manufacturer: input.manufacturer ?? null,
    model_number: input.model_number ?? null,
    serial_number: input.serial_number ?? null,
    installation_date: input.installation_date ?? null,
    last_maintenance_date: input.last_maintenance_date ?? null,
    next_maintenance_date: input.next_maintenance_date ?? null,
  });

export const makeMachineAssetTransitionEvent = (
  input: MakeMachineAssetTransitionEventInput
): MachineAssetTransitionEvent =>
  Schema.decodeUnknownSync(MachineAssetTransitionEventSchema)({
    machine_id: makeMachineAssetId(input.slug),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
    notes: input.notes ?? null,
  });

export const decodeMachineAssetSync = Schema.decodeUnknownSync(MachineAssetSchema);
export const decodeMachineAssetAgentStateSync = Schema.decodeUnknownSync(
  MachineAssetAgentStateSchema
);
export const decodeMachineAssetTransitionEventSync =
  Schema.decodeUnknownSync(MachineAssetTransitionEventSchema);
