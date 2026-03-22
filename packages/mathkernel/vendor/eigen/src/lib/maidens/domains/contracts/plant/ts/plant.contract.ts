import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical plant lifecycle status from iiot plant schema.
 */
export const PlantStatusSchema = Schema.Literal(
  'commissioning',
  'operational',
  'scheduled_shutdown',
  'emergency_shutdown',
  'maintenance_shutdown',
  'decommissioned'
).annotations({
  identifier: 'PlantStatus',
  title: 'Plant Status',
  description: 'ISA-95 plant lifecycle status.',
});

export type PlantStatus = typeof PlantStatusSchema.Type;

export const PLANT_ID_PATTERN = /^PLT-[a-zA-Z0-9-]+$/;

export const PlantIdSchema = Schema.String.pipe(Schema.pattern(PLANT_ID_PATTERN)).annotations({
  identifier: 'PlantId',
  title: 'Plant ID',
  description: 'Plant identifier in PLT-{slug} format.',
});

export type PlantId = typeof PlantIdSchema.Type;

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

export const PlantLocationSchema = Schema.Struct({
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  building: Schema.optional(Schema.String),
  floor: Schema.optional(Schema.String),
  zone: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String),
  timezone: Schema.optional(Schema.String),
}).annotations({
  identifier: 'PlantLocation',
  title: 'Plant Location',
  description: 'Physical location details for a plant.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'PlantMetadata',
  title: 'Plant Metadata',
  description: 'Extensible metadata map for plant payloads.',
});

/**
 * Canonical plant payload contract derived from src/lib/iiot/schemas/assets/plant/schema.ts.
 */
export const PlantSchema = Schema.Struct({
  plant_id: PlantIdSchema,
  name: Schema.NonEmptyString,
  status: PlantStatusSchema,
  timezone: Schema.String,
  site_code: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(PlantLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  enterprise_id: Schema.NullOr(Schema.String),
  site_id: Schema.NullOr(Schema.String),
  area_id: Schema.NullOr(Schema.String),
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Plant',
  title: 'Plant',
  description:
    'Canonical ISA-95 plant payload (Site/Area scoped parent of Line) generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Plant = typeof PlantSchema.Type;

export const PlantAgentStateSchema = PlantSchema.annotations({
  identifier: 'PlantAgentState',
  title: 'Plant Agent State',
  description: 'Canonical Jido agent-state contract for Plant runtime.',
});

export type PlantAgentState = typeof PlantAgentStateSchema.Type;

export const PlantTransitionEventSchema = Schema.Struct({
  plant_id: PlantIdSchema,
  from: PlantStatusSchema,
  to: PlantStatusSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'PlantTransitionEvent',
  title: 'Plant Transition Event',
  description: 'Transition payload contract for plant lifecycle events.',
});

export type PlantTransitionEvent = typeof PlantTransitionEventSchema.Type;

export const transitions = {
  commissioning: ['operational'],
  operational: ['scheduled_shutdown', 'emergency_shutdown', 'maintenance_shutdown'],
  scheduled_shutdown: ['operational', 'decommissioned'],
  emergency_shutdown: ['maintenance_shutdown'],
  maintenance_shutdown: ['operational', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<PlantStatus, readonly PlantStatus[]>>;

export const plantStates: ReadonlyArray<PlantStatus> = [
  'commissioning',
  'operational',
  'scheduled_shutdown',
  'emergency_shutdown',
  'maintenance_shutdown',
  'decommissioned',
];

export const isLegalTransition = (from: PlantStatus, to: PlantStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<PlantStatus, readonly PlantStatus[]>> = transitions
): string => toMermaidFor(graph, plantStates);

export interface MakePlantInput {
  readonly slug: string;
  readonly name: string;
  readonly status: PlantStatus;
  readonly timezone: string;
  readonly site_code?: string | null;
  readonly description?: string | null;
  readonly location?: {
    readonly latitude?: number;
    readonly longitude?: number;
    readonly building?: string;
    readonly floor?: string;
    readonly zone?: string;
    readonly address?: string;
    readonly timezone?: string;
  } | null;
  readonly metadata?: Record<string, unknown>;
  readonly hierarchy_path: string;
  readonly enterprise_id?: string | null;
  readonly site_id?: string | null;
  readonly area_id?: string | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakePlantTransitionEventInput {
  readonly slug: string;
  readonly from: PlantStatus;
  readonly to: PlantStatus;
  readonly at: string;
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

export const makePlantId = (slug: string): PlantId => {
  const candidate = `PLT-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(PlantIdSchema)(candidate);
};

export const makePlant = (input: MakePlantInput): Plant =>
  Schema.decodeUnknownSync(PlantSchema)({
    plant_id: makePlantId(input.slug),
    name: input.name,
    status: input.status,
    timezone: input.timezone,
    site_code: input.site_code ?? null,
    description: input.description ?? null,
    location: input.location ?? null,
    metadata: input.metadata ?? {},
    hierarchy_path: input.hierarchy_path,
    enterprise_id: input.enterprise_id ?? null,
    site_id: input.site_id ?? null,
    area_id: input.area_id ?? null,
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makePlantTransitionEvent = (
  input: MakePlantTransitionEventInput
): PlantTransitionEvent =>
  Schema.decodeUnknownSync(PlantTransitionEventSchema)({
    plant_id: makePlantId(input.slug),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodePlantSync = Schema.decodeUnknownSync(PlantSchema);
export const decodePlantAgentStateSync = Schema.decodeUnknownSync(PlantAgentStateSchema);
export const decodePlantTransitionEventSync =
  Schema.decodeUnknownSync(PlantTransitionEventSchema);
