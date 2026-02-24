import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical source alignment:
 * src/lib/iiot/schemas/assets/enterprise/schema.ts
 */
export const ENTERPRISE_ID_PATTERN = /^ENT-[a-zA-Z0-9-]+$/;

export const EnterpriseIdSchema = Schema.String.pipe(
  Schema.pattern(ENTERPRISE_ID_PATTERN)
).annotations({
  identifier: 'EnterpriseId',
  title: 'Enterprise ID',
  description: 'Enterprise identifier with ENT- prefix and slug.',
});

export type EnterpriseId = typeof EnterpriseIdSchema.Type;

export const EnterpriseStatusSchema = Schema.Literal(
  'active',
  'restructuring',
  'merged',
  'dissolved'
).annotations({
  identifier: 'EnterpriseStatus',
  title: 'Enterprise Status',
  description:
    'Enterprise lifecycle status per ISA-95 enterprise graph (active ↔ restructuring, active→merged, active|restructuring→dissolved).',
});

export type EnterpriseStatus = typeof EnterpriseStatusSchema.Type;

const IsoTimestampString = Schema.String.pipe(
  Schema.pattern(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
  )
).annotations({
  title: 'ISO8601 Timestamp',
  description: 'ISO8601 UTC or offset timestamp string.',
  jsonSchema: { format: 'date-time' },
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'EnterpriseMetadata',
  title: 'Enterprise Metadata',
  description: 'Extensible metadata map.',
});

const NullableTimestamp = Schema.Union(Schema.Null, IsoTimestampString).annotations({
  title: 'Nullable Timestamp',
  description: 'Timestamp value or null.',
});

export const EnterpriseSchema = Schema.Struct({
  enterprise_id: EnterpriseIdSchema,
  name: Schema.NonEmptyString,
  status: EnterpriseStatusSchema,
  industry: Schema.NullOr(Schema.String),
  legal_name: Schema.NullOr(Schema.String),
  tax_id: Schema.NullOr(Schema.String),
  headquarters: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Enterprise',
  title: 'Enterprise',
  description:
    'Canonical enterprise payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Enterprise = typeof EnterpriseSchema.Type;

export const EnterpriseAgentStateSchema = EnterpriseSchema.annotations({
  identifier: 'EnterpriseAgentState',
  title: 'Enterprise Agent State',
  description: 'Canonical Jido agent-state contract for Enterprise runtime.',
});

export type EnterpriseAgentState = typeof EnterpriseAgentStateSchema.Type;

export const EnterpriseTransitionEventSchema = Schema.Struct({
  enterprise_id: EnterpriseIdSchema,
  from: EnterpriseStatusSchema,
  to: EnterpriseStatusSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'EnterpriseTransitionEvent',
  title: 'Enterprise Transition Event',
  description: 'Transition payload contract for enterprise lifecycle events.',
});

export type EnterpriseTransitionEvent = typeof EnterpriseTransitionEventSchema.Type;

export const transitions = {
  active: ['restructuring', 'merged', 'dissolved'],
  restructuring: ['active', 'dissolved'],
  merged: [],
  dissolved: [],
} as const satisfies Readonly<
  Record<EnterpriseStatus, readonly EnterpriseStatus[]>
>;

export const enterpriseStates: ReadonlyArray<EnterpriseStatus> = [
  'active',
  'restructuring',
  'merged',
  'dissolved',
];

export const isLegalTransition = (
  from: EnterpriseStatus,
  to: EnterpriseStatus
): boolean => isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<EnterpriseStatus, readonly EnterpriseStatus[]>> = transitions
): string => toMermaidFor(graph, enterpriseStates);

export interface MakeEnterpriseInput {
  readonly slug: string;
  readonly name: string;
  readonly status?: EnterpriseStatus;
  readonly industry?: string | null;
  readonly legal_name?: string | null;
  readonly tax_id?: string | null;
  readonly headquarters?: string | null;
  readonly description?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at?: string | null;
}

export interface MakeEnterpriseTransitionEventInput {
  readonly slug: string;
  readonly from: EnterpriseStatus;
  readonly to: EnterpriseStatus;
  readonly at: string;
  readonly reason?: string | null;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-');

export const makeEnterpriseId = (slug: string): EnterpriseId =>
  Schema.decodeUnknownSync(EnterpriseIdSchema)(`ENT-${normalizeSlug(slug)}`);

export const makeEnterprise = (input: MakeEnterpriseInput): Enterprise =>
  Schema.decodeUnknownSync(EnterpriseSchema)({
    enterprise_id: makeEnterpriseId(input.slug),
    name: input.name,
    status: input.status ?? 'active',
    industry: input.industry ?? null,
    legal_name: input.legal_name ?? null,
    tax_id: input.tax_id ?? null,
    headquarters: input.headquarters ?? null,
    description: input.description ?? null,
    metadata: input.metadata ?? {},
    hierarchy_path: `/${makeEnterpriseId(input.slug)}`,
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makeEnterpriseTransitionEvent = (
  input: MakeEnterpriseTransitionEventInput
): EnterpriseTransitionEvent =>
  Schema.decodeUnknownSync(EnterpriseTransitionEventSchema)({
    enterprise_id: makeEnterpriseId(input.slug),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
  });

export const decodeEnterpriseSync = Schema.decodeUnknownSync(EnterpriseSchema);
export const decodeEnterpriseAgentStateSync =
  Schema.decodeUnknownSync(EnterpriseAgentStateSchema);
export const decodeEnterpriseTransitionEventSync =
  Schema.decodeUnknownSync(EnterpriseTransitionEventSchema);
