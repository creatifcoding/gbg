import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

export const AREA_ID_PATTERN = /^ARA-[a-zA-Z0-9-]+$/;

export const AreaIdSchema = Schema.String.pipe(
  Schema.pattern(AREA_ID_PATTERN)
).annotations({
  identifier: 'AreaId',
  title: 'Area ID',
  description: 'Area identifier with ARA- prefix and slug.',
});

export type AreaId = typeof AreaIdSchema.Type;

export const EnterpriseIdSchema = Schema.String.pipe(
  Schema.pattern(/^ENT-[a-zA-Z0-9-]+$/)
).annotations({
  identifier: 'EnterpriseId',
  title: 'Enterprise ID',
  description: 'Enterprise identifier with ENT- prefix and slug.',
});

export type EnterpriseId = typeof EnterpriseIdSchema.Type;

export const SiteIdSchema = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/)
).annotations({
  identifier: 'SiteId',
  title: 'Site ID',
  description: 'Site identifier with SIT- prefix and slug.',
});

export type SiteId = typeof SiteIdSchema.Type;

export const PlantIdSchema = Schema.String.pipe(
  Schema.pattern(/^PLT-[a-zA-Z0-9-]+$/)
).annotations({
  identifier: 'PlantId',
  title: 'Plant ID',
  description: 'Plant identifier with PLT- prefix and slug.',
});

export type PlantId = typeof PlantIdSchema.Type;

export const AreaStatusSchema = Schema.Literal(
  'active',
  'restricted',
  'maintenance',
  'inactive',
  'decommissioned'
).annotations({
  identifier: 'AreaStatus',
  title: 'Area Status',
  description: 'ISA-95 area lifecycle states.',
});

export type AreaStatus = typeof AreaStatusSchema.Type;

export const AreaTypeSchema = Schema.Literal(
  'production',
  'warehouse',
  'maintenance',
  'quality',
  'shipping',
  'receiving'
).annotations({
  identifier: 'AreaType',
  title: 'Area Type',
  description: 'Area classification values from canonical Area schema.',
});

export type AreaType = typeof AreaTypeSchema.Type;

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

const AreaLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'AreaLocation',
  title: 'Area Location',
  description: 'Location payload mirrored from canonical AssetLocation structure.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'AreaMetadata',
  title: 'Area Metadata',
  description: 'Extensible metadata map.',
});

export const AREA_HIERARCHY_PATH_PATTERN =
  /^\/ENT-[a-zA-Z0-9-]+\/SIT-[a-zA-Z0-9-]+(?:\/PLT-[a-zA-Z0-9-]+)?\/ARA-[a-zA-Z0-9-]+$/;

export const AreaHierarchyPathSchema = Schema.String.pipe(
  Schema.pattern(AREA_HIERARCHY_PATH_PATTERN)
).annotations({
  identifier: 'AreaHierarchyPath',
  title: 'Area Hierarchy Path',
  description:
    'Hierarchy path preserving ISA-95 semantics: Area under Site directly or under Plant within Site.',
});

export const AreaSchema = Schema.Struct({
  area_id: AreaIdSchema,
  name: Schema.NonEmptyString,
  status: AreaStatusSchema,
  enterprise_id: EnterpriseIdSchema,
  site_id: SiteIdSchema,
  area_type: Schema.NullOr(AreaTypeSchema),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(AreaLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: AreaHierarchyPathSchema,
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Area',
  title: 'Area',
  description:
    'Canonical Area payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Area = typeof AreaSchema.Type;

export const AreaAgentStateSchema = AreaSchema.annotations({
  identifier: 'AreaAgentState',
  title: 'Area Agent State',
  description: 'Canonical Jido agent-state contract for Area runtime.',
});

export type AreaAgentState = typeof AreaAgentStateSchema.Type;

export const AreaTransitionEventSchema = Schema.Struct({
  area_id: AreaIdSchema,
  from: AreaStatusSchema,
  to: AreaStatusSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'AreaTransitionEvent',
  title: 'Area Transition Event',
  description: 'Transition payload contract for area lifecycle events.',
});

export type AreaTransitionEvent = typeof AreaTransitionEventSchema.Type;

export const transitions = {
  active: ['restricted', 'maintenance', 'inactive'],
  restricted: ['active'],
  maintenance: ['active', 'decommissioned'],
  inactive: ['active', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<AreaStatus, readonly AreaStatus[]>>;

export const areaStates: ReadonlyArray<AreaStatus> = [
  'active',
  'restricted',
  'maintenance',
  'inactive',
  'decommissioned',
];

export const isLegalTransition = (from: AreaStatus, to: AreaStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<AreaStatus, readonly AreaStatus[]>> = transitions
): string => toMermaidFor(graph, areaStates);

export interface MakeAreaInput {
  readonly slug: string;
  readonly name: string;
  readonly status: AreaStatus;
  readonly enterprise_id: string;
  readonly site_id: string;
  readonly area_type?: AreaType | null;
  readonly building?: string | null;
  readonly floor?: string | null;
  readonly zone?: string | null;
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
  readonly hierarchy_path: string;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakeAreaTransitionEventInput {
  readonly slug: string;
  readonly from: AreaStatus;
  readonly to: AreaStatus;
  readonly at: string;
  readonly reason?: string | null;
  readonly by?: string | null;
}

export interface MakeAreaHierarchyPathInput {
  readonly enterprise_id: EnterpriseId | string;
  readonly site_id: SiteId | string;
  readonly slug: string;
  readonly plant_id?: PlantId | string | null;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-');

export const makeAreaId = (slug: string): AreaId => {
  const normalized = normalizeSlug(slug);
  const candidate = normalized.startsWith('ARA-') ? normalized : `ARA-${normalized}`;
  return Schema.decodeUnknownSync(AreaIdSchema)(candidate);
};

export const makeAreaHierarchyPath = (input: MakeAreaHierarchyPathInput): string => {
  const areaId = makeAreaId(input.slug);
  const enterpriseId = Schema.decodeUnknownSync(EnterpriseIdSchema)(input.enterprise_id);
  const siteId = Schema.decodeUnknownSync(SiteIdSchema)(input.site_id);

  const path = input.plant_id
    ? `/${enterpriseId}/${siteId}/${Schema.decodeUnknownSync(PlantIdSchema)(input.plant_id)}/${areaId}`
    : `/${enterpriseId}/${siteId}/${areaId}`;

  return Schema.decodeUnknownSync(AreaHierarchyPathSchema)(path);
};

export const makeArea = (input: MakeAreaInput): Area =>
  Schema.decodeUnknownSync(AreaSchema)({
    area_id: makeAreaId(input.slug),
    name: input.name,
    status: input.status,
    enterprise_id: input.enterprise_id,
    site_id: input.site_id,
    area_type: input.area_type ?? null,
    building: input.building ?? null,
    floor: input.floor ?? null,
    zone: input.zone ?? null,
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
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makeAreaTransitionEvent = (
  input: MakeAreaTransitionEventInput
): AreaTransitionEvent =>
  Schema.decodeUnknownSync(AreaTransitionEventSchema)({
    area_id: makeAreaId(input.slug),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    by: input.by ?? null,
  });

export const decodeAreaSync = Schema.decodeUnknownSync(AreaSchema);
export const decodeAreaAgentStateSync = Schema.decodeUnknownSync(AreaAgentStateSchema);
export const decodeAreaTransitionEventSync =
  Schema.decodeUnknownSync(AreaTransitionEventSchema);
