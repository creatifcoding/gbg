import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical source map:
 * - src/lib/iiot/schemas/asset-polymorphic.ts
 * - src/lib/iiot/schemas/assets/common/types.ts
 * - src/lib/iiot/schemas/identifiers.ts
 */
export const AssetCanonicalSourceMap = {
  preferred: 'src/lib/iiot/schemas/asset-polymorphic.ts',
  related: [
    'src/lib/iiot/schemas/assets/common/types.ts',
    'src/lib/iiot/schemas/identifiers.ts',
  ],
} as const;

export const AssetStatusSchema = Schema.Literal(
  'active',
  'inactive',
  'maintenance',
  'decommissioned'
).annotations({
  identifier: 'AssetStatus',
  title: 'Asset Status',
  description: 'Polymorphic ISA-95 asset lifecycle status.',
});

export type AssetStatus = typeof AssetStatusSchema.Type;

export const AssetKindSchema = Schema.Literal(
  'enterprise',
  'site',
  'area',
  'plant',
  'line',
  'workcell',
  'machine',
  'sensor',
  'device'
).annotations({
  identifier: 'AssetKind',
  title: 'Asset Kind',
  description: 'ISA-95 equipment hierarchy discriminator.',
});

export type AssetKind = typeof AssetKindSchema.Type;

export const SensorTypeSchema = Schema.Literal(
  'temperature',
  'vibration',
  'humidity',
  'speed',
  'current',
  'pressure',
  'flow',
  'level'
).annotations({
  identifier: 'SensorType',
  title: 'Sensor Type',
  description: 'Sensor type values from asset-polymorphic canonical schema.',
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
  description: 'Sensor measurement units from canonical polymorphic schema.',
});

export type MeasurementUnit = typeof MeasurementUnitSchema.Type;

export const ASSET_ID_PATTERN = /^(ENT|SIT|ARA|PLT|LIN|WCL|MCH|SNS|DEV)-[a-zA-Z0-9-]+$/;

export const AssetIdSchema = Schema.String.pipe(Schema.pattern(ASSET_ID_PATTERN)).annotations({
  identifier: 'AssetId',
  title: 'Asset ID',
  description:
    'Canonical ISA-95 asset identifier with hierarchy prefix (ENT|SIT|ARA|PLT|LIN|WCL|MCH|SNS|DEV).',
});

export type AssetId = typeof AssetIdSchema.Type;

export const EnterpriseIdSchema = Schema.String.pipe(
  Schema.pattern(/^ENT-[a-zA-Z0-9-]+$/)
).annotations({ identifier: 'EnterpriseId', title: 'Enterprise ID' });

export const SiteIdSchema = Schema.String.pipe(Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/)).annotations({
  identifier: 'SiteId',
  title: 'Site ID',
});

export const AreaIdSchema = Schema.String.pipe(Schema.pattern(/^ARA-[a-zA-Z0-9-]+$/)).annotations({
  identifier: 'AreaId',
  title: 'Area ID',
});

export const PlantIdSchema = Schema.String.pipe(Schema.pattern(/^PLT-[a-zA-Z0-9-]+$/)).annotations({
  identifier: 'PlantId',
  title: 'Plant ID',
});

export const LineIdSchema = Schema.String.pipe(Schema.pattern(/^LIN-[a-zA-Z0-9-]+$/)).annotations({
  identifier: 'LineId',
  title: 'Line ID',
});

export const WorkCellIdSchema = Schema.String.pipe(
  Schema.pattern(/^WCL-[a-zA-Z0-9-]+$/)
).annotations({
  identifier: 'WorkCellId',
  title: 'WorkCell ID',
});

export const MachineIdSchema = Schema.String.pipe(
  Schema.pattern(/^MCH-[a-zA-Z0-9-]+$/)
).annotations({
  identifier: 'MachineId',
  title: 'Machine ID',
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

export const AssetLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'AssetLocation',
  title: 'Asset Location',
  description: 'Canonical location payload shared across IIoT assets.',
});

const PropertiesSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'AssetProperties',
  title: 'Asset Properties',
  description: 'Polymorphic asset property map (asset-polymorphic.ts).',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'AssetMetadata',
  title: 'Asset Metadata',
  description: 'Shared metadata map (assets/common/types.ts).',
});

export const AssetSchema = Schema.Struct({
  asset_id: AssetIdSchema,
  name: Schema.NonEmptyString,
  kind: AssetKindSchema,
  status: AssetStatusSchema,
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(AssetLocationSchema),
  properties: PropertiesSchema,
  metadata: MetadataSchema,
  parent_id: Schema.NullOr(AssetIdSchema),
  hierarchy_path: Schema.NullOr(Schema.String),
  enterprise_id: Schema.NullOr(EnterpriseIdSchema),
  site_id: Schema.NullOr(SiteIdSchema),
  area_id: Schema.NullOr(AreaIdSchema),
  plant_id: Schema.NullOr(PlantIdSchema),
  line_id: Schema.NullOr(LineIdSchema),
  work_cell_id: Schema.NullOr(WorkCellIdSchema),
  machine_id: Schema.NullOr(MachineIdSchema),
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Asset',
  title: 'Asset',
  description:
    'Canonical polymorphic asset payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Asset = typeof AssetSchema.Type;

export const AssetAgentStateSchema = AssetSchema.annotations({
  identifier: 'AssetAgentState',
  title: 'Asset Agent State',
  description: 'Canonical Jido agent-state contract for Asset runtime.',
});

export type AssetAgentState = typeof AssetAgentStateSchema.Type;

export const AssetTransitionActionSchema = Schema.Literal(
  'Activate',
  'Deactivate',
  'StartMaintenance',
  'CompleteMaintenance',
  'Decommission'
).annotations({
  identifier: 'AssetTransitionAction',
  title: 'Asset Transition Action',
  description: 'Named transition actions for generic polymorphic asset lifecycle.',
});

export type AssetTransitionAction = typeof AssetTransitionActionSchema.Type;

export const AssetTransitionEventSchema = Schema.Struct({
  asset_id: AssetIdSchema,
  kind: Schema.optional(Schema.NullOr(AssetKindSchema)),
  from: AssetStatusSchema,
  to: AssetStatusSchema,
  action: Schema.optional(Schema.NullOr(AssetTransitionActionSchema)),
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'AssetTransitionEvent',
  title: 'Asset Transition Event',
  description: 'Transition payload contract for polymorphic asset lifecycle events.',
});

export type AssetTransitionEvent = typeof AssetTransitionEventSchema.Type;

export const transitions = {
  active: ['inactive', 'maintenance', 'decommissioned'],
  inactive: ['active', 'maintenance', 'decommissioned'],
  maintenance: ['active', 'inactive', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<AssetStatus, readonly AssetStatus[]>>;

export const assetStates: ReadonlyArray<AssetStatus> = [
  'active',
  'inactive',
  'maintenance',
  'decommissioned',
];

export const isLegalTransition = (from: AssetStatus, to: AssetStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<AssetStatus, readonly AssetStatus[]>> = transitions
): string => toMermaidFor(graph, assetStates);

export interface MakeAssetInput {
  readonly kind: AssetKind;
  readonly slug: string;
  readonly name: string;
  readonly status?: AssetStatus;
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
  readonly properties?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly parent_id?: string | null;
  readonly hierarchy_path?: string | null;
  readonly enterprise_id?: string | null;
  readonly site_id?: string | null;
  readonly area_id?: string | null;
  readonly plant_id?: string | null;
  readonly line_id?: string | null;
  readonly work_cell_id?: string | null;
  readonly machine_id?: string | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakeAssetTransitionEventInput {
  readonly kind?: AssetKind | null;
  readonly slug: string;
  readonly idKind: AssetKind;
  readonly from: AssetStatus;
  readonly to: AssetStatus;
  readonly at: string;
  readonly action?: AssetTransitionAction | null;
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

const ASSET_ID_PREFIX_BY_KIND: Readonly<Record<AssetKind, string>> = {
  enterprise: 'ENT',
  site: 'SIT',
  area: 'ARA',
  plant: 'PLT',
  line: 'LIN',
  workcell: 'WCL',
  machine: 'MCH',
  sensor: 'SNS',
  device: 'DEV',
};

export const makeAssetId = (kind: AssetKind, slug: string): AssetId => {
  const prefix = ASSET_ID_PREFIX_BY_KIND[kind];
  const candidate = `${prefix}-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(AssetIdSchema)(candidate);
};

export const makeAsset = (input: MakeAssetInput): Asset =>
  Schema.decodeUnknownSync(AssetSchema)({
    asset_id: makeAssetId(input.kind, input.slug),
    name: input.name,
    kind: input.kind,
    status: input.status ?? 'active',
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
    properties: input.properties ?? {},
    metadata: input.metadata ?? {},
    parent_id: input.parent_id ?? null,
    hierarchy_path: input.hierarchy_path ?? null,
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

export const makeAssetTransitionEvent = (
  input: MakeAssetTransitionEventInput
): AssetTransitionEvent =>
  Schema.decodeUnknownSync(AssetTransitionEventSchema)({
    asset_id: makeAssetId(input.idKind, input.slug),
    kind: input.kind ?? null,
    from: input.from,
    to: input.to,
    action: input.action ?? null,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodeAssetSync = Schema.decodeUnknownSync(AssetSchema);
export const decodeAssetAgentStateSync = Schema.decodeUnknownSync(AssetAgentStateSchema);
export const decodeAssetTransitionEventSync =
  Schema.decodeUnknownSync(AssetTransitionEventSchema);
