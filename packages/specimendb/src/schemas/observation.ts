import * as Schema from 'effect/Schema'
import { AttachmentId, ObservationId, SpecimenId } from './identifiers'
import { EvidenceKind } from './specimen'

/** An imaging or note event on a Specimen. CRUD, not event sourced. */
export const Observation = Schema.Struct({
  id: ObservationId,
  specimenId: SpecimenId,
  kind: EvidenceKind,
  note: Schema.String,
  attachmentIds: Schema.Array(AttachmentId),
  createdAt: Schema.Number,
})
export type Observation = typeof Observation.Type

export const decodeObservation = Schema.decodeUnknownSync(Observation)
