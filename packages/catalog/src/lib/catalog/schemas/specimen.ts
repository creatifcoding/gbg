import { Schema } from 'effect'
import {
  AttachmentId,
  ObservationId,
  QuestionId,
  SpecimenId,
  TagId,
} from './identifiers'
import { Guess } from './guess'

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
 * Specimen lifecycle. Linear happy path, skip-to-dead from any live state.
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

export const Specimen = Schema.Struct({
  _tag: Schema.Literal('Specimen'),
  id: SpecimenId,
  kind: EvidenceKind,
  status: SpecimenStatus,
  claim: Schema.NonEmptyString,
  body: Schema.String,
  organismGuess: Schema.NullOr(Guess),
  structureGuess: Schema.NullOr(Guess),
  locality: Schema.NullOr(Schema.NonEmptyString),
  observedAt: Schema.NullOr(Schema.NonEmptyString),
  tagIds: Schema.Array(TagId),
  questionIds: Schema.Array(QuestionId),
  observationIds: Schema.Array(ObservationId),
  attachmentIds: Schema.Array(AttachmentId),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type Specimen = typeof Specimen.Type

export const decodeStoredSpecimen = Schema.decodeUnknownSync(Specimen)

export function isEvidenceKind(value: string): value is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(value)
}

export function isSpecimenStatus(value: string): value is SpecimenStatus {
  return (SPECIMEN_STATUSES as readonly string[]).includes(value)
}
