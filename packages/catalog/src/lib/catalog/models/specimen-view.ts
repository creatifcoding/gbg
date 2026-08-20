import { Schema } from 'effect'
import { Attachment } from '../schemas/attachment'
import { Guess } from '../schemas/guess'
import { Locality, UNKNOWN_LOCALITY } from '../schemas/locality'
import { SpecimenId } from '../schemas/identifiers'
import { Observation } from '../schemas/observation'
import {
  EvidenceKind,
  SpecimenStatus,
  type Specimen,
} from '../schemas/specimen'
import type { CatalogSnapshot } from './catalog-snapshot'

export const SpecimenView = Schema.Struct({
  id: SpecimenId,
  kind: EvidenceKind,
  status: SpecimenStatus,
  claim: Schema.String,
  body: Schema.String,
  organismGuess: Schema.NullOr(Guess),
  structureGuess: Schema.NullOr(Guess),
  locality: Locality,
  observedAt: Schema.NullOr(Schema.NonEmptyString),
  cameraMake: Schema.NullOr(Schema.NonEmptyString),
  cameraModel: Schema.NullOr(Schema.NonEmptyString),
  tags: Schema.Array(Schema.NonEmptyString),
  questions: Schema.Array(Schema.NonEmptyString),
  observations: Schema.Array(Observation),
  attachments: Schema.Array(Attachment),
  example: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type SpecimenView = typeof SpecimenView.Type

export const decodeSpecimenView = Schema.decodeUnknownSync(SpecimenView)
export const encodeSpecimenView = Schema.encodeUnknownSync(SpecimenView)

export const CatalogFilter = Schema.Struct({
  kind: Schema.optional(EvidenceKind),
  status: Schema.optional(SpecimenStatus),
  tag: Schema.optional(Schema.NonEmptyString),
})
export type CatalogFilter = typeof CatalogFilter.Type

export function hydrateSpecimen(
  snapshot: CatalogSnapshot,
  specimen: Specimen,
): SpecimenView {
  const tagsById = new Map(snapshot.tags.map((tag) => [tag.id, tag]))
  const questionsById = new Map(
    snapshot.questions.map((question) => [question.id, question]),
  )
  const observations = snapshot.observations.filter(
    (item) => item.specimenId === specimen.id,
  )
  const attachments = snapshot.attachments.filter(
    (item) => item.specimenId === specimen.id,
  )

  return decodeSpecimenView({
    id: specimen.id,
    kind: specimen.kind,
    status: specimen.status,
    claim: specimen.claim ?? '',
    body: specimen.body ?? '',
    organismGuess: specimen.organismGuess ?? null,
    structureGuess: specimen.structureGuess ?? null,
    locality: specimen.locality ?? UNKNOWN_LOCALITY,
    observedAt: specimen.observedAt ?? null,
    cameraMake: specimen.cameraMake ?? null,
    cameraModel: specimen.cameraModel ?? null,
    tags: (specimen.tagIds ?? [])
      .map((id) => tagsById.get(id)?.slug)
      .filter((slug): slug is string => Boolean(slug)),
    questions: (specimen.questionIds ?? [])
      .map((id) => questionsById.get(id)?.text)
      .filter((text): text is string => Boolean(text)),
    observations,
    attachments,
    example: specimen.example,
    createdAt: specimen.createdAt,
    updatedAt: specimen.updatedAt,
  })
}

export function matchesFilter(
  view: SpecimenView,
  filter: CatalogFilter,
): boolean {
  if (filter.kind && view.kind !== filter.kind) return false
  if (filter.status && view.status !== filter.status) return false
  if (filter.tag && !view.tags.includes(filter.tag)) return false
  return true
}
