import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

export const WorkCellStatusSchema = Schema.Literal(
  'idle',
  'setup',
  'running',
  'blocked',
  'faulted',
  'maintenance',
  'decommissioned'
).annotations({
  identifier: 'WorkCellStatus',
  title: 'WorkCell Status',
  description: 'ISA-95 workcell operational state.',
});

export type WorkCellStatus = typeof WorkCellStatusSchema.Type;

export const WORKCELL_ID_PATTERN = /^WCL-[a-zA-Z0-9-]+$/;

export const WorkCellIdSchema = Schema.String.pipe(
  Schema.pattern(WORKCELL_ID_PATTERN)
).annotations({
  identifier: 'WorkCellId',
  title: 'WorkCell ID',
  description: 'WorkCell identifier in WCL-{slug} format.',
});

export type WorkCellId = typeof WorkCellIdSchema.Type;

export const LINE_ID_PATTERN = /^LIN-[a-zA-Z0-9-]+$/;

export const LineIdSchema = Schema.String.pipe(Schema.pattern(LINE_ID_PATTERN)).annotations({
  identifier: 'LineId',
  title: 'Line ID',
  description: 'Line identifier in LIN-{slug} format.',
});

export type LineId = typeof LineIdSchema.Type;

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

export const WorkCellLocationSchema = Schema.Struct({
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  building: Schema.optional(Schema.String),
  floor: Schema.optional(Schema.String),
  zone: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String),
  timezone: Schema.optional(Schema.String),
}).annotations({
  identifier: 'WorkCellLocation',
  title: 'WorkCell Location',
  description: 'Physical location details for a workcell.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'WorkCellMetadata',
  title: 'WorkCell Metadata',
  description: 'Extensible metadata map for workcell payloads.',
});

export const WorkCellSchema = Schema.Struct({
  workcell_id: WorkCellIdSchema,
  line_id: LineIdSchema,
  name: Schema.NonEmptyString,
  status: WorkCellStatusSchema,
  cell_type: Schema.NullOr(Schema.String),
  cycle_time_seconds: Schema.NullOr(Schema.Number.pipe(Schema.positive())),
  position: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(WorkCellLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  enterprise_id: Schema.NullOr(Schema.String),
  site_id: Schema.NullOr(Schema.String),
  area_id: Schema.NullOr(Schema.String),
  plant_id: Schema.NullOr(Schema.String),
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'WorkCell',
  title: 'WorkCell',
  description:
    'Canonical workcell payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type WorkCell = typeof WorkCellSchema.Type;

export const WorkCellAgentStateSchema = WorkCellSchema.annotations({
  identifier: 'WorkCellAgentState',
  title: 'WorkCell Agent State',
  description: 'Canonical Jido agent-state contract for WorkCell runtime preflight.',
});

export type WorkCellAgentState = typeof WorkCellAgentStateSchema.Type;

export const WorkCellTransitionEventSchema = Schema.Struct({
  workcell_id: WorkCellIdSchema,
  from: WorkCellStatusSchema,
  to: WorkCellStatusSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'WorkCellTransitionEvent',
  title: 'WorkCell Transition Event',
  description: 'Transition payload contract for workcell lifecycle events.',
});

export type WorkCellTransitionEvent = typeof WorkCellTransitionEventSchema.Type;

export const transitions = {
  idle: ['setup', 'maintenance', 'decommissioned'],
  setup: ['running'],
  running: ['idle', 'blocked', 'faulted'],
  blocked: ['running'],
  faulted: ['idle', 'maintenance'],
  maintenance: ['idle', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<WorkCellStatus, readonly WorkCellStatus[]>>;

export const workcellStates: ReadonlyArray<WorkCellStatus> = [
  'idle',
  'setup',
  'running',
  'blocked',
  'faulted',
  'maintenance',
  'decommissioned',
];

export const isOperational = (state: WorkCellStatus): boolean =>
  state === 'idle' || state === 'setup' || state === 'running';

export const isLegalTransition = (
  from: WorkCellStatus,
  to: WorkCellStatus
): boolean => isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<WorkCellStatus, readonly WorkCellStatus[]>> = transitions
): string => toMermaidFor(graph, workcellStates);

export interface MakeWorkCellInput {
  readonly slug: string;
  readonly line_id: string;
  readonly name: string;
  readonly status?: WorkCellStatus;
  readonly cell_type?: string | null;
  readonly cycle_time_seconds?: number | null;
  readonly position?: number | null;
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
  readonly plant_id?: string | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakeWorkCellTransitionEventInput {
  readonly slug: string;
  readonly from: WorkCellStatus;
  readonly to: WorkCellStatus;
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

export const makeWorkCellId = (slug: string): WorkCellId => {
  const candidate = `WCL-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(WorkCellIdSchema)(candidate);
};

export const makeWorkCell = (input: MakeWorkCellInput): WorkCell =>
  Schema.decodeUnknownSync(WorkCellSchema)({
    workcell_id: makeWorkCellId(input.slug),
    line_id: Schema.decodeUnknownSync(LineIdSchema)(input.line_id),
    name: input.name,
    status: input.status ?? 'idle',
    cell_type: input.cell_type ?? null,
    cycle_time_seconds: input.cycle_time_seconds ?? null,
    position: input.position ?? null,
    description: input.description ?? null,
    location: input.location ?? null,
    metadata: input.metadata ?? {},
    hierarchy_path: input.hierarchy_path,
    enterprise_id: input.enterprise_id ?? null,
    site_id: input.site_id ?? null,
    area_id: input.area_id ?? null,
    plant_id: input.plant_id ?? null,
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makeWorkCellTransitionEvent = (
  input: MakeWorkCellTransitionEventInput
): WorkCellTransitionEvent =>
  Schema.decodeUnknownSync(WorkCellTransitionEventSchema)({
    workcell_id: makeWorkCellId(input.slug),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodeWorkCellSync = Schema.decodeUnknownSync(WorkCellSchema);
export const decodeWorkCellAgentStateSync =
  Schema.decodeUnknownSync(WorkCellAgentStateSchema);
export const decodeWorkCellTransitionEventSync =
  Schema.decodeUnknownSync(WorkCellTransitionEventSchema);
