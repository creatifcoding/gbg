import * as Schema from 'effect/Schema'
import {
  AttachmentId,
  ObservationId,
  QuestionId,
  SpecimenId,
  TagId,
} from './identifiers'
import { Guess } from './guess'
import { Locality } from './locality'

/** How the first evidence arrived, or how a later Observation was dumped. */
export const EvidenceKind = Schema.Literals([
  'picture',
  'dossier',
  'artifact',
  'note',
] as const)
export type EvidenceKind = typeof EvidenceKind.Type

export const SpecimenStatus = Schema.Literals([
  'raw',
  'filed',
  'working',
  'dead',
] as const)
export type SpecimenStatus = typeof SpecimenStatus.Type

export const EVIDENCE_KINDS = [
  'picture',
  'dossier',
  'artifact',
  'note',
] as const satisfies ReadonlyArray<EvidenceKind>

export const SPECIMEN_STATUSES = [
  'raw',
  'filed',
  'working',
  'dead',
] as const satisfies ReadonlyArray<SpecimenStatus>

/**
 * Specimen lifecycle. raw is a complete dump, not a draft.
 * Taxon, GPS, mechanism, and analog are later links. Open questions are enough.
 * Linear happy path, skip-to-dead from any live state.
 * dead is deaccessioned. Do not auto-walk skipped states.
 */
const specimenTransitions: Record<SpecimenStatus, readonly SpecimenStatus[]> = {
  raw: ['filed', 'dead'],
  filed: ['working', 'dead'],
  working: ['dead'],
  dead: [],
}

export function isValidSpecimenTransition(
  from: SpecimenStatus,
  to: SpecimenStatus,
): boolean {
  return specimenTransitions[from].includes(to)
}

export function getValidNextSpecimenStates(
  current: SpecimenStatus,
): readonly SpecimenStatus[] {
  return specimenTransitions[current]
}

/**
 * Specimen is an entity: branded id plus arrival kind.
 * Status is attached at birth (`raw`). Every other field is an optional
 * component and may stay absent forever. This is not a Card row.
 */
export const Specimen = Schema.Struct({
  _tag: Schema.Literal('Specimen'),
  id: SpecimenId,
  kind: EvidenceKind,
  status: SpecimenStatus,
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  claim: Schema.optional(Schema.NonEmptyString),
  body: Schema.optional(Schema.String),
  organismGuess: Schema.optional(Schema.NullOr(Guess)),
  structureGuess: Schema.optional(Schema.NullOr(Guess)),
  locality: Schema.optional(Locality),
  observedAt: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  cameraMake: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  cameraModel: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  tagIds: Schema.optional(Schema.Array(TagId)),
  questionIds: Schema.optional(Schema.Array(QuestionId)),
  observationIds: Schema.optional(Schema.Array(ObservationId)),
  attachmentIds: Schema.optional(Schema.Array(AttachmentId)),
})
export type Specimen = typeof Specimen.Type

function omitAbsent<T extends object>(value: T): T {
  const next = { ...value }
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (next[key] === undefined) delete next[key]
  }
  return next
}

export const decodeStoredSpecimen = (input: unknown): Specimen =>
  omitAbsent(Schema.decodeUnknownSync(Specimen)(input))

export function isEvidenceKind(value: string): value is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(value)
}

export function isSpecimenStatus(value: string): value is SpecimenStatus {
  return (SPECIMEN_STATUSES as readonly string[]).includes(value)
}
