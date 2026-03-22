import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Canonical source alignment:
 * src/lib/iiot/schemas/assets/site/schema.ts
 */
export const SiteStatusSchema = Schema.Literal(
  'planned',
  'under_construction',
  'operational',
  'seasonal_shutdown',
  'closed',
  'decommissioned'
).annotations({
  identifier: 'SiteStatus',
  title: 'Site Status',
  description: 'ISA-95 site lifecycle status from canonical Site schema.',
});

export type SiteStatus = typeof SiteStatusSchema.Type;

export const SiteTransitionActionSchema = Schema.Literal(
  'BeginConstruction',
  'Commission',
  'SeasonalShutdown',
  'Reopen',
  'Close',
  'Decommission'
).annotations({
  identifier: 'SiteTransitionAction',
  title: 'Site Transition Action',
  description: 'Named transition actions from the canonical site lifecycle graph.',
});

export type SiteTransitionAction = typeof SiteTransitionActionSchema.Type;

export const SITE_ID_PATTERN = /^SIT-[a-zA-Z0-9-]+$/;
export const ENTERPRISE_ID_PATTERN = /^ENT-[a-zA-Z0-9-]+$/;

export const SiteIdSchema = Schema.String.pipe(Schema.pattern(SITE_ID_PATTERN)).annotations({
  identifier: 'SiteId',
  title: 'Site ID',
  description: 'Site identifier in SIT-{slug} format.',
});

export type SiteId = typeof SiteIdSchema.Type;

export const EnterpriseIdSchema = Schema.String.pipe(
  Schema.pattern(ENTERPRISE_ID_PATTERN)
).annotations({
  identifier: 'EnterpriseId',
  title: 'Enterprise ID',
  description: 'Enterprise identifier in ENT-{slug} format.',
});

export type EnterpriseId = typeof EnterpriseIdSchema.Type;

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

export const SiteLocationSchema = Schema.Struct({
  latitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-90, 90))),
  longitude: Schema.NullOr(Schema.Number.pipe(Schema.between(-180, 180))),
  building: Schema.NullOr(Schema.String),
  floor: Schema.NullOr(Schema.String),
  zone: Schema.NullOr(Schema.String),
  address: Schema.NullOr(Schema.String),
  timezone: Schema.NullOr(Schema.String),
}).annotations({
  identifier: 'SiteLocation',
  title: 'Site Location',
  description: 'Physical location payload mirrored from canonical AssetLocation structure.',
});

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'SiteMetadata',
  title: 'Site Metadata',
  description: 'Extensible metadata map.',
});

export const SiteSchema = Schema.Struct({
  site_id: SiteIdSchema,
  name: Schema.NonEmptyString,
  status: SiteStatusSchema,
  timezone: Schema.String,
  address: Schema.NullOr(Schema.String),
  city: Schema.NullOr(Schema.String),
  state: Schema.NullOr(Schema.String),
  country: Schema.NullOr(Schema.String),
  postal_code: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  location: Schema.NullOr(SiteLocationSchema),
  metadata: MetadataSchema,
  hierarchy_path: Schema.String,
  enterprise_id: EnterpriseIdSchema,
  created_at: IsoTimestampString,
  updated_at: NullableTimestamp,
}).annotations({
  identifier: 'Site',
  title: 'Site',
  description:
    'Canonical site payload generated from Effect Schema and consumed by Elixir runtime validators.',
});

export type Site = typeof SiteSchema.Type;

export const SiteAgentStateSchema = SiteSchema.annotations({
  identifier: 'SiteAgentState',
  title: 'Site Agent State',
  description: 'Canonical Jido agent-state contract for Site runtime.',
});

export type SiteAgentState = typeof SiteAgentStateSchema.Type;

export const SiteTransitionEventSchema = Schema.Struct({
  site_id: SiteIdSchema,
  from: SiteStatusSchema,
  to: SiteStatusSchema,
  action: Schema.optional(Schema.NullOr(SiteTransitionActionSchema)),
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
  initiated_by: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'SiteTransitionEvent',
  title: 'Site Transition Event',
  description: 'Transition payload contract for site lifecycle events.',
});

export type SiteTransitionEvent = typeof SiteTransitionEventSchema.Type;

export const transitions = {
  planned: ['under_construction'],
  under_construction: ['operational'],
  operational: ['seasonal_shutdown', 'closed'],
  seasonal_shutdown: ['operational'],
  closed: ['operational', 'decommissioned'],
  decommissioned: [],
} as const satisfies Readonly<Record<SiteStatus, readonly SiteStatus[]>>;

export const siteStates: ReadonlyArray<SiteStatus> = [
  'planned',
  'under_construction',
  'operational',
  'seasonal_shutdown',
  'closed',
  'decommissioned',
];

export const isLegalTransition = (from: SiteStatus, to: SiteStatus): boolean =>
  isLegalTransitionFor(transitions, from, to);

export const toMermaid = (
  graph: Readonly<Record<SiteStatus, readonly SiteStatus[]>> = transitions
): string => toMermaidFor(graph, siteStates);

export interface MakeSiteInput {
  readonly slug: string;
  readonly name: string;
  readonly enterprise_id: string;
  readonly timezone: string;
  readonly hierarchy_path: string;
  readonly created_at: string;
  readonly status?: SiteStatus;
  readonly address?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly country?: string | null;
  readonly postal_code?: string | null;
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
  readonly updated_at?: string | null;
}

export interface MakeSiteTransitionEventInput {
  readonly slug: string;
  readonly from: SiteStatus;
  readonly to: SiteStatus;
  readonly at: string;
  readonly action?: SiteTransitionAction | null;
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

export const makeSiteId = (slug: string): SiteId => {
  const candidate = `SIT-${normalizeSlug(slug)}`;
  return Schema.decodeUnknownSync(SiteIdSchema)(candidate);
};

export const makeSite = (input: MakeSiteInput): Site =>
  Schema.decodeUnknownSync(SiteSchema)({
    site_id: makeSiteId(input.slug),
    name: input.name,
    status: input.status ?? 'planned',
    timezone: input.timezone,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    postal_code: input.postal_code ?? null,
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
    enterprise_id: input.enterprise_id,
    created_at: input.created_at,
    updated_at: input.updated_at ?? null,
  });

export const makeSiteTransitionEvent = (
  input: MakeSiteTransitionEventInput
): SiteTransitionEvent =>
  Schema.decodeUnknownSync(SiteTransitionEventSchema)({
    site_id: makeSiteId(input.slug),
    from: input.from,
    to: input.to,
    action: input.action ?? null,
    at: input.at,
    reason: input.reason ?? null,
    initiated_by: input.initiated_by ?? null,
  });

export const decodeSiteSync = Schema.decodeUnknownSync(SiteSchema);
export const decodeSiteAgentStateSync = Schema.decodeUnknownSync(SiteAgentStateSchema);
export const decodeSiteTransitionEventSync =
  Schema.decodeUnknownSync(SiteTransitionEventSchema);
