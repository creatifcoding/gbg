/**
 * Lab provenance record — one shape for every entity that has a stable ref.
 *
 * Kind is a field, not a table. Specimen is a common bundle, not a privileged
 * type. Vocabulary is W3C PROV-DM (Entity / Activity / Agent, used /
 * wasGeneratedBy / wasAssociatedWith / wasDerivedFrom) encoded as Effect
 * Schema. Not RDF/OWL. Not OpenLineage. Not tmnl GEOINT provenance.
 *
 * W7 (who / what / when / where / why / how) lives on Kind=activity.
 * Honesty class lives on the generated entity. Operations are entities.
 *
 * EVA bind, PGlite tables, and activity-log RPC are later cuts (#61 / #76).
 *
 * @module @tmnl/specimendb/schemas/provenance
 */

import * as Schema from 'effect/Schema';
import {
  EntityRef,
  parseEntityRef,
  SpecimenId,
} from './identifiers.js';

/** v1 kinds. Later kinds are a schema change, not a new table. */
export const EntityKind = Schema.Literals([
  'specimen',
  'sheet',
  'solid',
  'media',
  'run',
  'report',
  'pr',
  'issue',
  'observation',
  'analog',
  'view',
  'activity',
] as const);
export type EntityKind = typeof EntityKind.Type;

/**
 * Honesty class. Travels on the generated entity. A Look PNG cannot promote it.
 * `live` only when the tool was present and the workflow passed.
 */
export const HonestyClass = Schema.Literals([
  'projected',
  'diagram',
  'theoretical',
  'draft-measured',
  'unverified',
  'live',
] as const);
export type HonestyClass = typeof HonestyClass.Type;

/** PROV agent types. Person / SoftwareAgent / Organization. */
export const AgentType = Schema.Literals(['person', 'software', 'organization'] as const);
export type AgentType = typeof AgentType.Type;

export class Agent extends Schema.TaggedClass<Agent>()('Agent', {
  agentType: AgentType,
  /** Human name, tool, login, or cloud-agent id. Not a display-only label for the entity ref. */
  label: Schema.String.check(Schema.isMinLength(1)),
  /** Optional durable handle (GitHub login, `bc-…`, tool id). Not GPS / taxon / SKU. */
  ref: Schema.optional(Schema.String),
}) {}

/** Optional content address. Path is a locator, not an id. */
export const ContentAddress = Schema.Struct({
  gitSha: Schema.optional(Schema.String),
  digest: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
});
export type ContentAddress = typeof ContentAddress.Type;

/** W7 `what` — entity refs in / out. PROV used / generated / invalidated. */
export const ProvenanceWhat = Schema.Struct({
  used: Schema.Array(EntityRef),
  generated: Schema.Array(EntityRef),
  invalidated: Schema.optional(Schema.Array(EntityRef)),
});
export type ProvenanceWhat = typeof ProvenanceWhat.Type;

/** W7 `when` — UTC plus optional git SHA of the tree. */
export const ProvenanceWhen = Schema.Struct({
  startedAt: Schema.String.check(Schema.isMinLength(1)),
  completedAt: Schema.optional(Schema.String),
  gitSha: Schema.optional(Schema.String),
});
export type ProvenanceWhen = typeof ProvenanceWhen.Type;

/**
 * Identity of PR 57 `doctor-report.v1.json`. Wrap the document; do not fork
 * its fields. `$id`: `urn:specimendb:biomemetics:mantis:environment-doctor-report:v1`.
 */
export const DOCTOR_REPORT_SCHEMA_ID =
  'urn:specimendb:biomemetics:mantis:environment-doctor-report:v1';

export const DoctorReportPayload = Schema.Struct({
  schemaVersion: Schema.Literals(['1.0.0'] as const),
  kind: Schema.Literals(['MantisEnvironmentDoctorReport'] as const),
  command: Schema.String.check(Schema.isMinLength(1)),
  startedAt: Schema.String.check(Schema.isMinLength(1)),
  completedAt: Schema.String.check(Schema.isMinLength(1)),
  runner: Schema.Unknown,
  lab: Schema.Unknown,
  tools: Schema.Unknown,
  shells: Schema.Unknown,
  checks: Schema.Unknown,
  fixtures: Schema.Unknown,
  blockers: Schema.Unknown,
  ok: Schema.Boolean,
  failed: Schema.Array(Schema.String),
  independentVerification: Schema.optional(Schema.Unknown),
});
export type DoctorReportPayload = typeof DoctorReportPayload.Type;

const labEntityFields = {
  /** Durable compact ref. Not a display name. */
  ref: EntityRef,
  /** Kind is data. */
  kind: EntityKind,
  /** Human name. Not the id. */
  label: Schema.String.check(Schema.isMinLength(1)),
  /** Honesty class. Required on every record. */
  class: HonestyClass,
  bytes: Schema.optional(ContentAddress),

  // PROV relations (refs). Queryable edges; not a second catalog.
  used: Schema.optional(Schema.Array(EntityRef)),
  generated: Schema.optional(Schema.Array(EntityRef)),
  wasGeneratedBy: Schema.optional(EntityRef),
  wasAssociatedWith: Schema.optional(Schema.Array(Agent)),
  wasDerivedFrom: Schema.optional(Schema.Array(EntityRef)),
  wasInvalidatedBy: Schema.optional(EntityRef),

  // W7 — required when kind=activity. `where` may be the string `unknown`.
  who: Schema.optional(Schema.Array(Agent)),
  what: Schema.optional(ProvenanceWhat),
  when: Schema.optional(ProvenanceWhen),
  where: Schema.optional(Schema.String),
  why: Schema.optional(Schema.String),
  how: Schema.optional(Schema.String),

  /** Existing SpecimenId when kind=specimen. Same brand; not a fork. */
  specimenId: Schema.optional(SpecimenId),

  /** Schema identity for a wrapped payload (doctor report `$id`). */
  payloadSchemaId: Schema.optional(Schema.String),
  payload: Schema.optional(Schema.Unknown),
} as const;

const activityHasW7 = Schema.makeFilter<{
  readonly kind: EntityKind;
  readonly who?: ReadonlyArray<Agent>;
  readonly what?: ProvenanceWhat;
  readonly when?: ProvenanceWhen;
  readonly where?: string;
  readonly why?: string;
  readonly how?: string;
  readonly specimenId?: SpecimenId;
  readonly ref: EntityRef;
}>((entity) => {
  if (entity.kind === 'activity') {
    if (
      entity.who === undefined ||
      entity.who.length === 0 ||
      entity.what === undefined ||
      entity.when === undefined ||
      entity.where === undefined ||
      entity.where.length === 0 ||
      entity.why === undefined ||
      entity.why.length === 0 ||
      entity.how === undefined ||
      entity.how.length === 0
    ) {
      return 'activity entities require W7: who, what, when, where, why, how';
    }
  }
  if (entity.kind === 'specimen') {
    const parsed = parseEntityRef(entity.ref);
    if (parsed === undefined || parsed.kind !== 'specimen') {
      return 'specimen entities must use ref gbg:specimen:<id>';
    }
    if (entity.specimenId === undefined || entity.specimenId !== parsed.local) {
      return 'specimenId must equal the local part of gbg:specimen:<id>';
    }
  }
  return undefined;
});

/**
 * One Effect Schema record for sheets, solids, runs, specimens, activities.
 * Views are projections over this record; they are not a second SoT.
 */
export class LabEntity extends Schema.TaggedClass<LabEntity>()('LabEntity', labEntityFields) {}

/** Decode path that enforces W7 on activities and specimen-id mapping. */
export const LabEntityRecord = LabEntity.pipe(Schema.check(activityHasW7));

export const decodeLabEntity = Schema.decodeUnknownSync(LabEntityRecord);
export const decodeDoctorReportPayload = Schema.decodeUnknownSync(DoctorReportPayload);
