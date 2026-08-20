import {
  decodeStoredSpecimen,
  isValidSpecimenTransition,
  type EvidenceKind,
  type Specimen,
  type SpecimenStatus,
} from '../schemas/specimen'
import type { SpecimenCreated, SpecimenEvent } from '../schemas/events/specimen-events'
import type {
  AttachmentId,
  ObservationId,
  QuestionId,
  SpecimenId,
  TagId,
} from '../schemas/identifiers'
import type { Guess } from '../schemas/guess'

export class SpecimenTransitionError extends Error {
  readonly _tag = 'SpecimenTransitionError'
  constructor(
    readonly specimenId: SpecimenId,
    readonly from: SpecimenStatus,
    readonly to: SpecimenStatus,
  ) {
    super(`Cannot move specimen ${specimenId} from ${from} to ${to}`)
    this.name = 'SpecimenTransitionError'
  }
}

export type CreateSpecimenInput = {
  id: SpecimenId
  kind: EvidenceKind
  claim: string
  organismGuess: Guess | null
  structureGuess?: Guess | null
  locality?: string | null
  observedAt?: string | null
  tagIds: ReadonlyArray<TagId>
  questionIds: ReadonlyArray<QuestionId>
  observationIds?: ReadonlyArray<ObservationId>
  attachmentIds?: ReadonlyArray<AttachmentId>
  example?: boolean
}

function eventId(now: number, suffix: string): SpecimenCreated['id'] {
  return `evt_${now}_${suffix}` as SpecimenCreated['id']
}

export function createSpecimen(
  input: CreateSpecimenInput,
  now = Date.now(),
): { specimen: Specimen; event: SpecimenEvent } {
  const specimen = decodeStoredSpecimen({
    _tag: 'Specimen',
    id: input.id,
    kind: input.kind,
    status: 'raw',
    claim: input.claim,
    body: '',
    organismGuess: input.organismGuess,
    structureGuess: input.structureGuess ?? null,
    locality: input.locality ?? null,
    observedAt: input.observedAt ?? null,
    tagIds: [...input.tagIds],
    questionIds: [...input.questionIds],
    observationIds: [...(input.observationIds ?? [])],
    attachmentIds: [...(input.attachmentIds ?? [])],
    example: input.example ?? false,
    createdAt: now,
    updatedAt: now,
  })

  const event: SpecimenEvent = {
    id: eventId(now, `${specimen.id}_created`),
    type: 'SpecimenCreated',
    entityId: specimen.id,
    occurredAt: now,
    payload: { kind: specimen.kind, claim: specimen.claim },
  }

  return { specimen, event }
}

export function transitionSpecimen(
  specimen: Specimen,
  to: SpecimenStatus,
  now = Date.now(),
): { specimen: Specimen; event: SpecimenEvent } {
  if (!isValidSpecimenTransition(specimen.status, to)) {
    throw new SpecimenTransitionError(specimen.id, specimen.status, to)
  }

  const next = decodeStoredSpecimen({
    ...specimen,
    status: to,
    updatedAt: now,
  })

  const event: SpecimenEvent = {
    id: eventId(now, `${specimen.id}_${specimen.status}_${to}`),
    type: 'SpecimenTransitioned',
    entityId: specimen.id,
    occurredAt: now,
    payload: { from: specimen.status, to },
  }

  return { specimen: next, event }
}

export function setSpecimenBody(
  specimen: Specimen,
  body: string,
  now = Date.now(),
): { specimen: Specimen; event: SpecimenEvent } {
  const next = decodeStoredSpecimen({
    ...specimen,
    body,
    updatedAt: now,
  })

  const event: SpecimenEvent = {
    id: eventId(now, `${specimen.id}_body`),
    type: 'SpecimenBodySet',
    entityId: specimen.id,
    occurredAt: now,
    payload: {},
  }

  return { specimen: next, event }
}

export function attachToSpecimen(
  specimen: Specimen,
  attachmentId: AttachmentId,
  now = Date.now(),
): Specimen {
  if (specimen.attachmentIds.includes(attachmentId)) return specimen
  return decodeStoredSpecimen({
    ...specimen,
    attachmentIds: [...specimen.attachmentIds, attachmentId],
    updatedAt: now,
  })
}

export function addObservationToSpecimen(
  specimen: Specimen,
  observationId: ObservationId,
  now = Date.now(),
): Specimen {
  if (specimen.observationIds.includes(observationId)) return specimen
  return decodeStoredSpecimen({
    ...specimen,
    observationIds: [...specimen.observationIds, observationId],
    updatedAt: now,
  })
}
