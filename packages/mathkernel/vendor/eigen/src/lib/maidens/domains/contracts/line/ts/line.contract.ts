import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical line lifecycle status from iiot line schema.
 */
export const LineStatusSchema = Schema.Literal(
  'idle',
  'running',
  'changeover',
  'starved',
  'blocked',
  'maintenance',
  'decommissioned'
).annotations({
  identifier: 'LineStatus',
  title: 'Line Status',
  description: 'ISA-95 line operational status.',
});

export type LineStatus = typeof LineStatusSchema.Type;

export const LINE_ID_PATTERN = /^LIN-[a-zA-Z0-9-]+$/;

export const LineIdSchema = Schema.String.pipe(Schema.pattern(LINE_ID_PATTERN)).annotations({
  identifier: 'LineId',
  title: 'Line ID',
  description: 'Line identifier in LIN-{slug} format.',
});

export type LineId = typeof LineIdSchema.Type;

export const PlantIdSchema = Schema.String.pipe(Schema.pattern(/^PLT-[a-zA-Z0-9-]+$/)).annotations({
  identifier: 'PlantId',
  title: 'Plant ID',
  description: 'Plant identifier in PLT-{slug} format.',
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

export const LineLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'LineLocation',
  title: 'Line Location',
  description: 'Physical location details for a production line.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'LineMetadata',
  title: 'Line Metadata',
  description: 'Extensible metadata map for line payloads.',
});

/**
 * Canonical line payload contract derived from src/lib/iiot/schemas/assets/line/schema.ts.
 */
export const LineSchema = Schema.Struct({
  line_id: LineIdSchema,
  name: Schema.NonEmptyString,
  status: LineStatusSchema,
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(LineLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  enterprise_id: Schema.NullOr(Schema.String),
  site_id: Schema.NullOr(Schema.String),
  area_id: Schema.NullOr(Schema.String),
  plant_id: Schema.NullOr(PlantIdSchema),
  capacity: Schema.NullOr(Schema.Number.pipe(Schema.positive())),
  line_type: Schema.NullOr(Schema.String),
  operating_hours_per_day: Schema.NullOr(Schema.Number.pipe(Schema.between(0, 24))),
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Line',
  title: 'Line',
  description:
    'Canonical line payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Line = typeof LineSchema.Type;

export const LineAgentStateSchema = LineSchema.annotations({
  identifier: 'LineAgentState',
  title: 'Line Agent State',
  description: 'Canonical Jido agent-state contract for Line runtime.',
});

export type LineAgentState = typeof LineAgentStateSchema.Type;

export const LineTransitionEventSchema = Schema.Struct({
  line_id: LineIdSchema,
  from: LineStatusSchema,
  to: LineStatusSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'LineTransitionEvent',
  title: 'Line Transition Event',
  description: 'Transition payload contract for line lifecycle events.',
});

export type LineTransitionEvent = typeof LineTransitionEventSchema.Type;

export const transitions = {
  idle: ['running', 'changeover', 'maintenance', 'decommissioned'],
  running: ['idle', 'changeover', 'starved', 'blocked', 'maintenance'],
  changeover: ['idle', 'running', 'maintenance'],
  starved: ['running', 'blocked', 'idle', 'maintenance'],
  blocked: ['running', 'starved', 'idle', 'maintenance'],
  maintenance: ['idle', 'running', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<LineStatus, readonly LineStatus[]>>;

export const lineStates: ReadonlyArray<LineStatus> = [
  'idle',
  'running',
  'changeover',
  'starved',
  'blocked',
  'maintenance',
  'decommissioned',
];

export const isLegalTransition = (from: LineStatus, to: LineStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<LineStatus, readonly LineStatus[]>> = transitions
): string => toMermaidFor(graph, lineStates);

export interface MakeLineInput {
  readonly slug: string;
  readonly name: string;
  readonly status: LineStatus;
  readonly hierarchy_path: string;
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
  readonly capacity?: number | null;
  readonly line_type?: string | null;
  readonly operating_hours_per_day?: number | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakeLineTransitionEventInput {
  readonly slug: string;
  readonly from: LineStatus;
  readonly to: LineStatus;
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

export const makeLineId = (slug: string): LineId => {
  const candidate = `LIN-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(LineIdSchema)(candidate);
};

export const makeLine = (input: MakeLineInput): Line =>
  Schema.decodeUnknownSync(LineSchema)({
    line_id: makeLineId(input.slug),
    name: input.name,
    status: input.status,
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
    capacity: input.capacity ?? null,
    line_type: input.line_type ?? null,
    operating_hours_per_day: input.operating_hours_per_day ?? null,
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makeLineTransitionEvent = (
  input: MakeLineTransitionEventInput
): LineTransitionEvent =>
  Schema.decodeUnknownSync(LineTransitionEventSchema)({
    line_id: makeLineId(input.slug),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodeLineSync = Schema.decodeUnknownSync(LineSchema);
export const decodeLineAgentStateSync = Schema.decodeUnknownSync(LineAgentStateSchema);
export const decodeLineTransitionEventSync =
  Schema.decodeUnknownSync(LineTransitionEventSchema);
