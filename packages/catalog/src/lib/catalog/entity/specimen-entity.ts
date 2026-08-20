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
import { UNKNOWN_LOCALITY, type Locality } from '../schemas/locality'

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

/** Entity spawn. Only id and kind. Status(raw) attaches at birth. */
export type SpawnSpecimenInput = {
  id: SpecimenId
  kind: EvidenceKind
  example?: boolean
}

/** Optional components. Omit anything the dump does not have. */
export type SpecimenComponents = {
  claim?: string | null
  body?: string | null
  organismGuess?: Guess | null
  structureGuess?: Guess | null
  locality?: Locality | null
  observedAt?: string | null
  cameraMake?: string | null
  cameraModel?: string | null
  tagIds?: ReadonlyArray<TagId>
  questionIds?: ReadonlyArray<QuestionId>
  observationIds?: ReadonlyArray<ObservationId>
  attachmentIds?: ReadonlyArray<AttachmentId>
}

export type CreateSpecimenInput = SpawnSpecimenInput & SpecimenComponents

function eventId(now: number, suffix: string): SpecimenCreated['id'] {
  return `evt_${now}_${suffix}` as SpecimenCreated['id']
}

function presentText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : undefined
}

function presentList<T>(value: ReadonlyArray<T> | undefined): T[] | undefined {
  if (!value || value.length === 0) return undefined
  return [...value]
}

function presentLocality(value: Locality | null | undefined): Locality | undefined {
  if (!value || value._tag === 'unknown') return undefined
  return value
}

function presentGuess(value: Guess | null | undefined): Guess | undefined {
  return value ?? undefined
}

function decodeEntity(
  input: SpawnSpecimenInput &
    SpecimenComponents & {
      createdAt?: number
      updatedAt?: number
    },
  now: number,
  status: SpecimenStatus,
): Specimen {
  return decodeStoredSpecimen({
    _tag: 'Specimen',
    id: input.id,
    kind: input.kind,
    status,
    example: input.example ?? false,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    claim: presentText(input.claim),
    body: presentText(input.body),
    organismGuess: presentGuess(input.organismGuess),
    structureGuess: presentGuess(input.structureGuess),
    locality: presentLocality(input.locality),
    observedAt: presentText(input.observedAt),
    cameraMake: presentText(input.cameraMake),
    cameraModel: presentText(input.cameraModel),
    tagIds: presentList(input.tagIds),
    questionIds: presentList(input.questionIds),
    observationIds: presentList(input.observationIds),
    attachmentIds: presentList(input.attachmentIds),
  })
}

export function spawnSpecimen(
  input: SpawnSpecimenInput,
  now = Date.now(),
): { specimen: Specimen; event: SpecimenEvent } {
  return createSpecimen(input, now)
}

/**
 * Spawn a Specimen entity and attach only the components in hand.
 * Does not require taxon, GPS, mechanism, analog, claim, or tags.
 */
export function createSpecimen(
  input: CreateSpecimenInput,
  now = Date.now(),
): { specimen: Specimen; event: SpecimenEvent } {
  const specimen = decodeEntity(input, now, 'raw')
  const claim = presentText(input.claim)
  const event: SpecimenEvent = {
    id: eventId(now, `${specimen.id}_created`),
    type: 'SpecimenCreated',
    entityId: specimen.id,
    occurredAt: now,
    payload: claim
      ? { kind: specimen.kind, claim }
      : { kind: specimen.kind },
  }
  return { specimen, event }
}

export function attachSpecimenComponents(
  specimen: Specimen,
  components: SpecimenComponents,
  now = Date.now(),
): Specimen {
  return decodeEntity(
    {
      id: specimen.id,
      kind: specimen.kind,
      example: specimen.example,
      createdAt: specimen.createdAt,
      claim: components.claim ?? specimen.claim,
      body: components.body ?? specimen.body,
      organismGuess: components.organismGuess ?? specimen.organismGuess,
      structureGuess: components.structureGuess ?? specimen.structureGuess,
      locality: components.locality ?? specimen.locality,
      observedAt: components.observedAt ?? specimen.observedAt,
      cameraMake: components.cameraMake ?? specimen.cameraMake,
      cameraModel: components.cameraModel ?? specimen.cameraModel,
      tagIds: components.tagIds ?? specimen.tagIds,
      questionIds: components.questionIds ?? specimen.questionIds,
      observationIds: components.observationIds ?? specimen.observationIds,
      attachmentIds: components.attachmentIds ?? specimen.attachmentIds,
    },
    now,
    specimen.status,
  )
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
  const next = attachSpecimenComponents(specimen, { body }, now)

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
  const attachmentIds = specimen.attachmentIds ?? []
  if (attachmentIds.includes(attachmentId)) return specimen
  return attachSpecimenComponents(
    specimen,
    { attachmentIds: [...attachmentIds, attachmentId] },
    now,
  )
}

export function addObservationToSpecimen(
  specimen: Specimen,
  observationId: ObservationId,
  now = Date.now(),
): Specimen {
  const observationIds = specimen.observationIds ?? []
  if (observationIds.includes(observationId)) return specimen
  return attachSpecimenComponents(
    specimen,
    { observationIds: [...observationIds, observationId] },
    now,
  )
}

export { UNKNOWN_LOCALITY }
