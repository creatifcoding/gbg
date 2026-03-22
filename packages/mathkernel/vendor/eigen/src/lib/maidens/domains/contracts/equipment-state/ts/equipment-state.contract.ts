import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

export const EquipmentStateTypeSchema = Schema.Literal(
  'running',
  'idle',
  'planned_downtime',
  'unplanned_downtime',
  'setup',
  'blocked'
).annotations({
  identifier: 'EquipmentStateType',
  title: 'Equipment State Type',
  description: 'ISA-95 / OEE equipment state categories.',
});

export type EquipmentStateType = typeof EquipmentStateTypeSchema.Type;

export const EquipmentStateReasonSchema = Schema.Literal(
  'production',
  'test_run',
  'warmup',
  'no_operator',
  'no_order',
  'awaiting_material',
  'scheduled_maintenance',
  'break',
  'shift_change',
  'cleaning',
  'breakdown',
  'quality_issue',
  'tool_failure',
  'electrical',
  'mechanical',
  'changeover',
  'tooling_change',
  'material_change',
  'starved',
  'blocked_downstream',
  'waiting_approval',
  'other',
  'unknown'
).annotations({
  identifier: 'EquipmentStateReason',
  title: 'Equipment State Reason',
  description: 'Detailed reason codes aligned with iiot equipment-state schema.',
});

export type EquipmentStateReason = typeof EquipmentStateReasonSchema.Type;

export const EQUIPMENT_STATE_ID_PATTERN =
  /^[A-Z][A-Z0-9_-]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EquipmentStateIdSchema = Schema.String.pipe(
  Schema.pattern(EQUIPMENT_STATE_ID_PATTERN)
).annotations({
  identifier: 'EquipmentStateId',
  title: 'Equipment State ID',
  description:
    'Slug-prefixed UUID (e.g. EST-CNC-LATHE-001-550e8400-e29b-41d4-a716-446655440000).',
});

export type EquipmentStateId = typeof EquipmentStateIdSchema.Type;

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

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'EquipmentStateMetadata',
  title: 'Equipment State Metadata',
  description: 'Extensible metadata map.',
});

export const EquipmentStateSchema = Schema.Struct({
  equipment_state_id: EquipmentStateIdSchema,
  machine_id: Schema.String,
  state: EquipmentStateTypeSchema,
  reason: Schema.NullOr(EquipmentStateReasonSchema),
  started_at: IsoTimestampString,
  ended_at: NullableTimestamp,
  operator_id: Schema.NullOr(Schema.String),
  notes: Schema.NullOr(Schema.String),
  metadata: MetadataSchema,
}).annotations({
  identifier: 'EquipmentState',
  title: 'EquipmentState',
  description:
    'Canonical equipment-state payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type EquipmentState = typeof EquipmentStateSchema.Type;

export const EquipmentStateAgentStateSchema = EquipmentStateSchema.annotations({
  identifier: 'EquipmentStateAgentState',
  title: 'Equipment State Agent State',
  description: 'Canonical Jido agent-state contract for EquipmentState runtime.',
});

export type EquipmentStateAgentState = typeof EquipmentStateAgentStateSchema.Type;

export const EquipmentStateTransitionEventSchema = Schema.Struct({
  equipment_state_id: EquipmentStateIdSchema,
  machine_id: Schema.String,
  from: EquipmentStateTypeSchema,
  to: EquipmentStateTypeSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(EquipmentStateReasonSchema)),
  operator_id: Schema.optional(Schema.NullOr(Schema.String)),
  notes: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'EquipmentStateTransitionEvent',
  title: 'Equipment State Transition Event',
  description: 'Transition payload contract for equipment-state lifecycle events.',
});

export type EquipmentStateTransitionEvent =
  typeof EquipmentStateTransitionEventSchema.Type;

export const transitions = {
  running: ['idle', 'planned_downtime', 'unplanned_downtime', 'setup', 'blocked'],
  idle: ['running', 'planned_downtime', 'unplanned_downtime', 'setup', 'blocked'],
  planned_downtime: ['idle', 'running', 'unplanned_downtime', 'setup'],
  unplanned_downtime: ['idle', 'running', 'planned_downtime', 'setup'],
  setup: ['running', 'idle', 'unplanned_downtime', 'blocked'],
  blocked: ['running', 'idle', 'unplanned_downtime', 'setup'],
} as const satisfies Readonly<
  Record<EquipmentStateType, readonly EquipmentStateType[]>
>;

export const equipmentStates: ReadonlyArray<EquipmentStateType> = [
  'running',
  'idle',
  'planned_downtime',
  'unplanned_downtime',
  'setup',
  'blocked',
];

export const stateReasons = {
  running: ['production', 'test_run', 'warmup'],
  idle: ['no_operator', 'no_order', 'awaiting_material', 'other', 'unknown'],
  planned_downtime: ['scheduled_maintenance', 'break', 'shift_change', 'cleaning', 'other'],
  unplanned_downtime: [
    'breakdown',
    'quality_issue',
    'tool_failure',
    'electrical',
    'mechanical',
    'other',
    'unknown',
  ],
  setup: ['changeover', 'tooling_change', 'material_change', 'other'],
  blocked: ['starved', 'blocked_downstream', 'waiting_approval', 'other'],
} as const satisfies Readonly<
  Record<EquipmentStateType, readonly EquipmentStateReason[]>
>;

export const getValidReasonsForState = (
  state: EquipmentStateType
): ReadonlyArray<EquipmentStateReason> => stateReasons[state];

export const isLegalTransition = (
  from: EquipmentStateType,
  to: EquipmentStateType
): boolean => isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<EquipmentStateType, readonly EquipmentStateType[]>> = transitions
): string => toMermaidFor(graph, equipmentStates);

export interface MakeEquipmentStateInput {
  readonly slug: string;
  readonly machine_id: string;
  readonly state: EquipmentStateType;
  readonly started_at: string;
  readonly reason?: EquipmentStateReason | null;
  readonly ended_at?: string | null;
  readonly operator_id?: string | null;
  readonly notes?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly uuid?: string;
}

export interface MakeEquipmentStateTransitionEventInput {
  readonly slug: string;
  readonly machine_id: string;
  readonly from: EquipmentStateType;
  readonly to: EquipmentStateType;
  readonly at: string;
  readonly reason?: EquipmentStateReason | null;
  readonly operator_id?: string | null;
  readonly notes?: string | null;
  readonly uuid?: string;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '-');

export const makeEquipmentStateId = (
  slug: string,
  uuid = crypto.randomUUID()
): EquipmentStateId => {
  const candidate = `${normalizeSlug(slug)}-${uuid.toLowerCase()}`;
  return Schema.decodeUnknownSync(EquipmentStateIdSchema)(candidate);
};

export const makeEquipmentState = (input: MakeEquipmentStateInput): EquipmentState =>
  Schema.decodeUnknownSync(EquipmentStateSchema)({
    equipment_state_id: makeEquipmentStateId(input.slug, input.uuid),
    machine_id: input.machine_id,
    state: input.state,
    reason: input.reason ?? null,
    started_at: input.started_at,
    ended_at: input.ended_at ?? null,
    operator_id: input.operator_id ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  });

export const makeEquipmentStateTransitionEvent = (
  input: MakeEquipmentStateTransitionEventInput
): EquipmentStateTransitionEvent =>
  Schema.decodeUnknownSync(EquipmentStateTransitionEventSchema)({
    equipment_state_id: makeEquipmentStateId(input.slug, input.uuid),
    machine_id: input.machine_id,
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    operator_id: input.operator_id ?? null,
    notes: input.notes ?? null,
  });

export const decodeEquipmentStateSync = Schema.decodeUnknownSync(EquipmentStateSchema);
export const decodeEquipmentStateAgentStateSync =
  Schema.decodeUnknownSync(EquipmentStateAgentStateSchema);
export const decodeEquipmentStateTransitionEventSync =
  Schema.decodeUnknownSync(EquipmentStateTransitionEventSchema);
