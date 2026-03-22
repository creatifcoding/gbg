import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

export const AlarmStateSchema = Schema.Literal(
  'unacknowledged',
  'acknowledged',
  'shelved',
  'suppressed',
  'cleared',
  'out_of_service'
).annotations({
  identifier: 'AlarmState',
  title: 'Alarm State',
  description: 'ISA-18.2 alarm lifecycle states.',
});

export type AlarmState = typeof AlarmStateSchema.Type;

export const AlarmSeveritySchema = Schema.Literal(
  'info',
  'warning',
  'critical',
  'emergency'
).annotations({
  identifier: 'AlarmSeverity',
  title: 'Alarm Severity',
  description: 'ISA-18.2 severity classes.',
});

export type AlarmSeverity = typeof AlarmSeveritySchema.Type;

export const ALARM_ID_PATTERN =
  /^[A-Z][A-Z0-9_-]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const AlarmIdSchema = Schema.String.pipe(
  Schema.pattern(ALARM_ID_PATTERN)
).annotations({
  identifier: 'AlarmId',
  title: 'Alarm ID',
  description: 'Slug-prefixed UUID (e.g. ALM-HIGH-TEMP-550e8400-e29b-41d4-a716-446655440000).',
});

export type AlarmId = typeof AlarmIdSchema.Type;

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

export const AlarmSchema = Schema.Struct({
  alarm_id: AlarmIdSchema,
  device_id: Schema.String,
  asset_id: Schema.NullOr(Schema.String),
  severity: AlarmSeveritySchema,
  state: AlarmStateSchema,
  message: Schema.NullOr(Schema.String),
  triggered_at: IsoTimestampString,
  acknowledged_at: NullableTimestamp,
  acknowledged_by: Schema.NullOr(Schema.String),
  cleared_at: NullableTimestamp,
  shelved_until: NullableTimestamp,
  suppression_reason: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'Alarm',
  title: 'Alarm',
  description:
    'Canonical alarm state payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Alarm = typeof AlarmSchema.Type;

export const AlarmAgentStateSchema = AlarmSchema.annotations({
  identifier: 'AlarmAgentState',
  title: 'Alarm Agent State',
  description: 'Canonical Jido agent-state contract for Alarm runtime.',
});

export type AlarmAgentState = typeof AlarmAgentStateSchema.Type;

export const AlarmTransitionEventSchema = Schema.Struct({
  alarm_id: AlarmIdSchema,
  from: AlarmStateSchema,
  to: AlarmStateSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  by: Schema.optional(Schema.NullOr(Schema.String)),
  shelved_until: Schema.optional(NullableTimestamp),
}).annotations({
  identifier: 'AlarmTransitionEvent',
  title: 'Alarm Transition Event',
  description: 'Transition payload contract for alarm lifecycle events.',
});

export type AlarmTransitionEvent = typeof AlarmTransitionEventSchema.Type;

export const transitions = {
  unacknowledged: ['acknowledged', 'shelved', 'suppressed', 'out_of_service'],
  acknowledged: ['cleared', 'shelved', 'suppressed', 'out_of_service'],
  shelved: ['unacknowledged', 'acknowledged', 'out_of_service'],
  suppressed: ['unacknowledged', 'acknowledged', 'out_of_service'],
  cleared: ['unacknowledged'],
  out_of_service: ['unacknowledged', 'cleared'],
} as const satisfies Readonly<Record<AlarmState, readonly AlarmState[]>>;

export const alarmStates: ReadonlyArray<AlarmState> = [
  'unacknowledged',
  'acknowledged',
  'shelved',
  'suppressed',
  'cleared',
  'out_of_service',
];

export const isLegalTransition = (from: AlarmState, to: AlarmState): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<AlarmState, readonly AlarmState[]>> = transitions
): string => toMermaidFor(graph, alarmStates);

export interface MakeAlarmInput {
  readonly slug: string;
  readonly device_id: string;
  readonly asset_id?: string | null;
  readonly severity: AlarmSeverity;
  readonly state: AlarmState;
  readonly message?: string | null;
  readonly triggered_at: string;
  readonly acknowledged_at?: string | null;
  readonly acknowledged_by?: string | null;
  readonly cleared_at?: string | null;
  readonly shelved_until?: string | null;
  readonly suppression_reason?: string | null;
  readonly uuid?: string;
}

export interface MakeAlarmTransitionEventInput {
  readonly slug: string;
  readonly from: AlarmState;
  readonly to: AlarmState;
  readonly at: string;
  readonly reason?: string | null;
  readonly by?: string | null;
  readonly shelved_until?: string | null;
  readonly uuid?: string;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '-');

export const makeAlarmId = (slug: string, uuid = crypto.randomUUID()): AlarmId => {
  const candidate = `${normalizeSlug(slug)}-${uuid.toLowerCase()}`;
  return Schema.decodeUnknownSync(AlarmIdSchema)(candidate);
};

export const makeAlarm = (input: MakeAlarmInput): Alarm =>
  Schema.decodeUnknownSync(AlarmSchema)({
    alarm_id: makeAlarmId(input.slug, input.uuid),
    device_id: input.device_id,
    asset_id: input.asset_id ?? null,
    severity: input.severity,
    state: input.state,
    message: input.message ?? null,
    triggered_at: input.triggered_at,
    acknowledged_at: input.acknowledged_at ?? null,
    acknowledged_by: input.acknowledged_by ?? null,
    cleared_at: input.cleared_at ?? null,
    shelved_until: input.shelved_until ?? null,
    suppression_reason: input.suppression_reason ?? null,
  });

export const makeAlarmTransitionEvent = (
  input: MakeAlarmTransitionEventInput
): AlarmTransitionEvent =>
  Schema.decodeUnknownSync(AlarmTransitionEventSchema)({
    alarm_id: makeAlarmId(input.slug, input.uuid),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
    by: input.by ?? null,
    shelved_until: input.shelved_until ?? null,
  });

export const decodeAlarmSync = Schema.decodeUnknownSync(AlarmSchema);
export const decodeAlarmAgentStateSync = Schema.decodeUnknownSync(AlarmAgentStateSchema);
export const decodeAlarmTransitionEventSync =
  Schema.decodeUnknownSync(AlarmTransitionEventSchema);
