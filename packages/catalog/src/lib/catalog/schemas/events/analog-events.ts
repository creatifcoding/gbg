import { Schema } from 'effect'
import { AnalogId, EventId } from '../identifiers'
import { AnalogStatus } from '../analog'

export const AnalogCreated = Schema.Struct({
  id: EventId,
  type: Schema.Literal('AnalogCreated'),
  entityId: AnalogId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({
    claim: Schema.NonEmptyString,
  }),
})
export type AnalogCreated = typeof AnalogCreated.Type

export const AnalogTransitioned = Schema.Struct({
  id: EventId,
  type: Schema.Literal('AnalogTransitioned'),
  entityId: AnalogId,
  occurredAt: Schema.Number,
  payload: Schema.Struct({
    from: AnalogStatus,
    to: AnalogStatus,
  }),
})
export type AnalogTransitioned = typeof AnalogTransitioned.Type

export const AnalogEvent = Schema.Union([AnalogCreated, AnalogTransitioned])
export type AnalogEvent = typeof AnalogEvent.Type
