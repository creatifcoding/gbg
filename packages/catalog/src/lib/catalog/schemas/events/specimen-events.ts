import { Schema } from 'effect'
import { EventId, SpecimenId } from '../identifiers'
import { EvidenceKind, SpecimenStatus } from '../specimen'

export const SpecimenCreated = Schema.Struct({
  id: EventId,
  type: Schema.Literal('SpecimenCreated'),
  entityId: SpecimenId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({
    kind: EvidenceKind,
    claim: Schema.NonEmptyString,
  }),
})
export type SpecimenCreated = typeof SpecimenCreated.Type

export const SpecimenTransitioned = Schema.Struct({
  id: EventId,
  type: Schema.Literal('SpecimenTransitioned'),
  entityId: SpecimenId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({
    from: SpecimenStatus,
    to: SpecimenStatus,
  }),
})
export type SpecimenTransitioned = typeof SpecimenTransitioned.Type

export const SpecimenBodySet = Schema.Struct({
  id: EventId,
  type: Schema.Literal('SpecimenBodySet'),
  entityId: SpecimenId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({}),
})
export type SpecimenBodySet = typeof SpecimenBodySet.Type

export const SpecimenEvent = Schema.Union([
  SpecimenCreated,
  SpecimenTransitioned,
  SpecimenBodySet,
])
export type SpecimenEvent = typeof SpecimenEvent.Type
