import { Schema } from 'effect'
import { CardId, EventId } from '../identifiers'
import { CardKind, CardStatus } from '../card'

export const CardCreated = Schema.Struct({
  id: EventId,
  type: Schema.Literal('CardCreated'),
  entityId: CardId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({
    kind: CardKind,
    claim: Schema.NonEmptyString,
  }),
})
export type CardCreated = typeof CardCreated.Type

export const CardTransitioned = Schema.Struct({
  id: EventId,
  type: Schema.Literal('CardTransitioned'),
  entityId: CardId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({
    from: CardStatus,
    to: CardStatus,
  }),
})
export type CardTransitioned = typeof CardTransitioned.Type

export const CardBodySet = Schema.Struct({
  id: EventId,
  type: Schema.Literal('CardBodySet'),
  entityId: CardId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({}),
})
export type CardBodySet = typeof CardBodySet.Type

export const CardEvent = Schema.Union([CardCreated, CardTransitioned, CardBodySet])
export type CardEvent = typeof CardEvent.Type
